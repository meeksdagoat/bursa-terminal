import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import type { HistoryPayload } from "@/lib/types";
import { isTrackedSymbol } from "@/lib/universe";
import { fetchDailyCloses } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;
const MAX_SYMBOLS = 40;

function parseSymbols(raw: string | null): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];

  for (const token of (raw ?? "").split(",")) {
    const symbol = token.trim();
    if (!symbol || seen.has(symbol) || !isTrackedSymbol(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
    if (symbols.length >= MAX_SYMBOLS) break;
  }

  return symbols;
}

function parseFrom(raw: string | null): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T00:00:00+08:00`);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date(Date.now() - 400 * 86_400_000);
}

export async function GET(request: NextRequest) {
  const symbols = parseSymbols(request.nextUrl.searchParams.get("symbols"));
  const from = parseFrom(request.nextUrl.searchParams.get("from"));
  const fromKey = from.toISOString().slice(0, 10);

  if (symbols.length === 0) {
    const empty: HistoryPayload = {
      source: "yahoo",
      asOf: new Date().toISOString(),
      from: fromKey,
      series: {},
      errors: [],
    };
    return Response.json(empty, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const payload = await cached(`history:${fromKey}:${symbols.slice().sort().join(",")}`, TTL_MS, async () => {
      const errors: string[] = [];
      const series: HistoryPayload["series"] = {};

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const points = await fetchDailyCloses(symbol, from);
            return { symbol, points };
          } catch (error) {
            errors.push(
              `${symbol}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return { symbol, points: [] };
          }
        }),
      );

      for (const row of results) {
        if (row.points.length > 0) series[row.symbol] = row.points;
      }

      return {
        source: "yahoo",
        asOf: new Date().toISOString(),
        from: fromKey,
        series,
        errors,
      } satisfies HistoryPayload;
    });

    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `History request failed: ${detail}` }, { status: 502 });
  }
}
