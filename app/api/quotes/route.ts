import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { isBursaOpen } from "@/lib/market-status";
import { sectorPerformance, withBlueChipSectors } from "@/lib/sectors";
import type { Quote, QuotesPayload, UniverseEntry } from "@/lib/types";
import { DEFAULT_WATCHLIST, KLCI_SYMBOL, entryBySymbol } from "@/lib/universe";
import { fetchLastSessionMoves, fetchQuotes } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 8 * 1000;
const MAX_SYMBOLS = 60;

/**
 * Only tracked symbols are honoured: it keeps the upstream request bounded and
 * stops an arbitrary query string from becoming an unbounded cache key.
 */
function parseSymbols(raw: string | null): UniverseEntry[] {
  const requested = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const seen = new Set<string>();
  const entries: UniverseEntry[] = [];

  for (const symbol of requested) {
    if (seen.has(symbol) || entries.length >= MAX_SYMBOLS) continue;
    const entry = entryBySymbol(symbol);
    if (!entry) continue;
    seen.add(symbol);
    entries.push(entry);
  }

  if (entries.length > 0) return entries;

  return DEFAULT_WATCHLIST.flatMap((symbol) => {
    const entry = entryBySymbol(symbol);
    return entry ? [entry] : [];
  });
}

function tapeIsIdle(quotes: Quote[]): boolean {
  if (quotes.length === 0) return true;
  return quotes.every((quote) => (quote.volume ?? 0) <= 0 || (quote.changePct ?? 0) === 0);
}

async function withLastSessionMoves(quotes: Quote[], entries: UniverseEntry[]): Promise<Quote[]> {
  if (!tapeIsIdle(quotes) && isBursaOpen()) return quotes;

  const sample: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.sector)) continue;
    seen.add(entry.sector);
    sample.push(entry.symbol);
  }

  const cacheKey = `last-session:${[...sample].sort().join(",")}`;
  const moves = await cached(cacheKey, 30 * 60 * 1000, () => fetchLastSessionMoves(sample));
  const bySector = new Map<string, number>();
  for (const entry of entries) {
    const pct = moves.get(entry.symbol);
    if (pct != null) bySector.set(entry.sector, pct);
  }

  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  return entries.flatMap((entry) => {
    const quote = quoteBySymbol.get(entry.symbol);
    if (!quote) return [];
    const sessionPct = moves.get(entry.symbol) ?? bySector.get(entry.sector);
    if (sessionPct == null) return [quote];
    if (quote.changePct != null && quote.changePct !== 0 && (quote.volume ?? 0) > 0) return [quote];
    const previous = quote.previousClose ?? quote.price;
    const change =
      previous != null && Number.isFinite(previous) ? (previous * sessionPct) / 100 : quote.change;
    return [{ ...quote, changePct: sessionPct, change: change ?? quote.change }];
  });
}

async function buildPayload(entries: UniverseEntry[]): Promise<QuotesPayload> {
  const symbols = entries.map((entry) => entry.symbol);
  const rows = await fetchQuotes([...symbols, KLCI_SYMBOL]);
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  const liveQuotes = symbols.flatMap((symbol) => {
    const quote = bySymbol.get(symbol);
    return quote ? [quote] : [];
  });

  const quotes =
    entries.length >= 6 ? await withLastSessionMoves(liveQuotes, entries) : liveQuotes;

  const changeBySymbol = new Map(
    quotes.flatMap((quote) => (quote.changePct == null ? [] : [[quote.symbol, quote.changePct]])),
  );

  const reference = quotes[0] ?? null;

  return {
    source: "yahoo",
    asOf: new Date().toISOString(),
    delayMinutes: reference?.delayMinutes ?? null,
    marketState: reference?.marketState ?? null,
    quotes,
    index: bySymbol.get(KLCI_SYMBOL) ?? null,
    sectors: withBlueChipSectors(
      sectorPerformance(
        entries.map((entry) => ({
          sector: entry.sector,
          changePct: changeBySymbol.get(entry.symbol) ?? null,
        })),
      ),
      quotes,
    ),
  };
}

export async function GET(request: NextRequest) {
  const entries = parseSymbols(request.nextUrl.searchParams.get("symbols"));
  const cacheKey = `quotes:${entries
    .map((entry) => entry.symbol)
    .slice()
    .sort()
    .join(",")}`;

  try {
    const payload = await cached(cacheKey, TTL_MS, () => buildPayload(entries));
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Quote request failed: ${detail}` }, { status: 502 });
  }
}
