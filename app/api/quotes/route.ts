import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { sectorPerformance } from "@/lib/sectors";
import type { QuotesPayload, UniverseEntry } from "@/lib/types";
import { DEFAULT_WATCHLIST, KLCI_SYMBOL, entryBySymbol } from "@/lib/universe";
import { fetchQuotes } from "@/lib/yahoo";

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

async function buildPayload(entries: UniverseEntry[]): Promise<QuotesPayload> {
  const symbols = entries.map((entry) => entry.symbol);
  const rows = await fetchQuotes([...symbols, KLCI_SYMBOL]);
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  const quotes = symbols.flatMap((symbol) => {
    const quote = bySymbol.get(symbol);
    return quote ? [quote] : [];
  });

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
    sectors: sectorPerformance(
      entries.map((entry) => ({
        sector: entry.sector,
        changePct: changeBySymbol.get(entry.symbol) ?? null,
      })),
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
