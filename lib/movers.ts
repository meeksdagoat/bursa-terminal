import "server-only";

import { cached } from "./cache";
import { fallbackMoversPayload } from "./movers-fallback";
import type { MarketBreadth, MoverRow, MoversPayload, Quote } from "./types";
import { DEFAULT_WATCHLIST, KLCI_SYMBOL, liquidUniverse } from "./universe";
import { fetchLastSessionMoves, fetchQuotes } from "./yahoo";

/**
 * Liquid-name scan behind the overview board. The search universe is 1,100+
 * tickers; Yahoo is only asked for the curated liquid set so the board stays fast.
 */

/** Yahoo truncates very long symbol lists, so the universe is requested in batches. */
const CHUNK_SIZE = 45;
const BOARD_SIZE = 6;

/** Bounded liquid sample for last-session closes when the live tape is idle. */
const LAST_SESSION_SAMPLE = [
  ...new Set([
    ...DEFAULT_WATCHLIST,
    "1066.KL",
    "5819.KL",
    "5225.KL",
    "4863.KL",
    "1961.KL",
    "2445.KL",
    "8869.KL",
    "3816.KL",
    "6888.KL",
    "7277.KL",
  ]),
];

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function breadthOf(rows: MoverRow[]): MarketBreadth {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;

  for (const row of rows) {
    const changePct = row.quote.changePct ?? 0;
    if (changePct > 0) advancers += 1;
    else if (changePct < 0) decliners += 1;
    else unchanged += 1;
  }

  return { advancers, decliners, unchanged, covered: rows.length, universe: liquidUniverse.length };
}

function toRows(bySymbol: Map<string, Quote>, requireVolume: boolean): MoverRow[] {
  return liquidUniverse.flatMap((entry) => {
    const quote = bySymbol.get(entry.symbol);
    if (!quote || quote.price == null || quote.changePct == null) return [];
    if (requireVolume && (quote.volume ?? 0) <= 0) return [];
    if (quote.changePct === 0) return [];
    return [{ ...entry, quote }];
  });
}

function snapshot(
  rows: MoverRow[],
  bySymbol: Map<string, Quote>,
  errors: string[],
  lastSession: boolean,
): MoversPayload {
  const ranked = [...rows].sort((a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0));
  const reference =
    ranked.find((row) => row.quote.marketState != null)?.quote ??
    bySymbol.get(KLCI_SYMBOL) ??
    null;

  return {
    source: "yahoo",
    asOf: new Date().toISOString(),
    delayMinutes: reference?.delayMinutes ?? 15,
    marketState: reference?.marketState ?? null,
    index: bySymbol.get(KLCI_SYMBOL) ?? null,
    gainers: ranked.filter((row) => (row.quote.changePct ?? 0) > 0).slice(0, BOARD_SIZE),
    losers: ranked
      .filter((row) => (row.quote.changePct ?? 0) < 0)
      .slice(-BOARD_SIZE)
      .reverse(),
    breadth: breadthOf(rows),
    errors,
    lastSession,
  };
}

export async function getMoversSnapshot(): Promise<MoversPayload> {
  const errors: string[] = [];
  const batches = chunk([...liquidUniverse.map((entry) => entry.symbol), KLCI_SYMBOL], CHUNK_SIZE);

  const results = await Promise.all(
    batches.map(async (symbols) => {
      try {
        return await fetchQuotes(symbols);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return [] as Quote[];
      }
    }),
  );

  const bySymbol = new Map(results.flat().map((quote) => [quote.symbol, quote]));

  const liveRows = toRows(bySymbol, true);
  if (liveRows.length > 0) {
    return snapshot(liveRows, bySymbol, errors, false);
  }

  const quotedRows = toRows(bySymbol, false);
  if (quotedRows.length > 0) {
    return snapshot(quotedRows, bySymbol, errors, true);
  }

  const sample = LAST_SESSION_SAMPLE.filter((symbol) => bySymbol.has(symbol));
  const targets = sample.length > 0 ? sample : LAST_SESSION_SAMPLE;
  const cacheKey = `movers-last-session:${[...targets].sort().join(",")}`;

  try {
    const moves = await cached(cacheKey, 30 * 60 * 1000, () => fetchLastSessionMoves(targets));
    const sessionRows: MoverRow[] = liquidUniverse.flatMap((entry) => {
      const pct = moves.get(entry.symbol);
      const quote = bySymbol.get(entry.symbol);
      if (pct == null || pct === 0 || quote == null || quote.price == null) return [];
      const previous = quote.previousClose ?? quote.price;
      const change =
        previous != null && Number.isFinite(previous) ? (previous * pct) / 100 : quote.change;
      return [{ ...entry, quote: { ...quote, changePct: pct, change: change ?? quote.change } }];
    });
    if (sessionRows.length > 0) {
      return snapshot(sessionRows, bySymbol, errors, true);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return fallbackMoversPayload(errors, bySymbol.get(KLCI_SYMBOL) ?? null);
}
