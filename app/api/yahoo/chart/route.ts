import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { fetchAssetHistory } from "@/lib/quant/fetchAssetHistory";
import { isQuantHubSymbol } from "@/lib/quant/asset-catalog";
import { isUsTickerSymbol } from "@/constants/usTickers";
import { isTrackedSymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;

const BENCHMARK_ALLOWLIST = new Set([
  "^KLSE",
  "^GSPC",
  "QQQ",
  "GC=F",
  "XAUUSD=X",
  "BZ=F",
  "CL=F",
  "KO=F",
  "USDMYR=X",
  "BTC-USD",
  "SI=F",
  "GLD",
  "SLV",
]);

function parseSymbol(raw: string | null): string | null {
  const symbol = raw?.trim();
  if (!symbol) return null;
  if (
    isTrackedSymbol(symbol) ||
    BENCHMARK_ALLOWLIST.has(symbol) ||
    isQuantHubSymbol(symbol) ||
    isUsTickerSymbol(symbol)
  ) {
    return symbol;
  }
  return null;
}

function parseFrom(raw: string | null): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T00:00:00+08:00`);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date(Date.now() - 400 * 86_400_000);
}

/** Yahoo daily chart proxy with commodity mapping and forward-filled closes. */
export async function GET(request: NextRequest) {
  const symbol = parseSymbol(request.nextUrl.searchParams.get("symbol"));
  const from = parseFrom(request.nextUrl.searchParams.get("from"));
  const fromKey = from.toISOString().slice(0, 10);

  if (!symbol) {
    return Response.json({ error: "Unsupported or missing symbol" }, { status: 400 });
  }

  try {
    const payload = await cached(`yahoo-chart:${symbol}:${fromKey}`, TTL_MS, () =>
      fetchAssetHistory(symbol, from),
    );

    if (payload.hardError && payload.points.length === 0) {
      return Response.json(
        {
          error: payload.hardError,
          symbol: payload.requestedSymbol,
          resolvedSymbol: payload.resolvedSymbol,
        },
        { status: 502 },
      );
    }

    return Response.json(
      {
        symbol: payload.requestedSymbol,
        resolvedSymbol: payload.resolvedSymbol,
        from: fromKey,
        asOf: new Date().toISOString(),
        points: payload.points,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Chart request failed: ${detail}` }, { status: 502 });
  }
}
