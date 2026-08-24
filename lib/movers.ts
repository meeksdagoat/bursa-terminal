import "server-only";

import type { MarketBreadth, MoverRow, MoversPayload, Quote } from "./types";
import { KLCI_SYMBOL, universe } from "./universe";
import { fetchQuotes } from "./yahoo";

/**
 * Whole-universe scan behind the overview board. Yahoo's quote endpoint is the
 * only free source that covers every Bursa counter, and it has no ranking API
 * for this exchange, so the leaderboard is computed here from live quotes.
 */

/** Yahoo truncates very long symbol lists, so the universe is requested in batches. */
const CHUNK_SIZE = 45;
const BOARD_SIZE = 6;

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

  return { advancers, decliners, unchanged, covered: rows.length, universe: universe.length };
}

export async function getMoversSnapshot(): Promise<MoversPayload> {
  const errors: string[] = [];
  const batches = chunk([...universe.map((entry) => entry.symbol), KLCI_SYMBOL], CHUNK_SIZE);

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

  // A counter with no volume has not traded today, so its change percentage is
  // carried over from an earlier session and would rank as a phantom mover.
  const rows: MoverRow[] = universe.flatMap((entry) => {
    const quote = bySymbol.get(entry.symbol);
    if (!quote || quote.price == null || quote.changePct == null) return [];
    if ((quote.volume ?? 0) <= 0) return [];
    return [{ ...entry, quote }];
  });

  if (rows.length === 0) {
    throw new Error(errors.length > 0 ? errors.join("; ") : "No live quotes returned");
  }

  const ranked = [...rows].sort((a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0));
  const reference = ranked.find((row) => row.quote.marketState != null)?.quote ?? ranked[0].quote;

  return {
    source: "yahoo",
    asOf: new Date().toISOString(),
    delayMinutes: reference.delayMinutes,
    marketState: reference.marketState,
    index: bySymbol.get(KLCI_SYMBOL) ?? null,
    gainers: ranked.filter((row) => (row.quote.changePct ?? 0) > 0).slice(0, BOARD_SIZE),
    losers: ranked
      .filter((row) => (row.quote.changePct ?? 0) < 0)
      .slice(-BOARD_SIZE)
      .reverse(),
    breadth: breadthOf(rows),
    errors,
  };
}
