import { cached } from "@/lib/cache";
import type { QuotesPayload, SectorPerformance } from "@/lib/types";
import { KLCI_SYMBOL, universe, universeSymbols } from "@/lib/universe";
import { fetchQuotes } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 30 * 1000;

function sectorPerformance(bySymbol: Map<string, number>): SectorPerformance[] {
  const buckets = new Map<string, number[]>();

  for (const entry of universe) {
    const changePct = bySymbol.get(entry.symbol);
    const bucket = buckets.get(entry.sector) ?? [];
    if (changePct != null) bucket.push(changePct);
    buckets.set(entry.sector, bucket);
  }

  return [...buckets.entries()]
    .map(([name, values]) => ({
      name,
      changePct:
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      count: values.length,
    }))
    .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
}

async function buildPayload(): Promise<QuotesPayload> {
  const rows = await fetchQuotes([...universeSymbols, KLCI_SYMBOL]);
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  const quotes = universeSymbols.flatMap((symbol) => {
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
    sectors: sectorPerformance(changeBySymbol),
  };
}

export async function GET() {
  try {
    const payload = await cached("quotes", TTL_MS, buildPayload);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Quote request failed: ${detail}` }, { status: 502 });
  }
}
