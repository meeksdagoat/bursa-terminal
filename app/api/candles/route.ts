import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { isIntervalKey, isRangeKey } from "@/lib/ranges";
import { KLCI_SYMBOL, universeSymbols } from "@/lib/universe";
import { fetchCandles, fetchIntervalCandles } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 60 * 1000;
const ALLOWED_SYMBOLS = new Set([...universeSymbols, KLCI_SYMBOL]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") ?? "";
  const interval = searchParams.get("interval");
  const range = searchParams.get("range") ?? "1M";

  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  try {
    if (interval) {
      if (!isIntervalKey(interval)) {
        return Response.json({ error: `Unsupported interval: ${interval}` }, { status: 400 });
      }
      const payload = await cached(`candles:${symbol}:i:${interval}`, TTL_MS, () =>
        fetchIntervalCandles(symbol, interval),
      );
      return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    if (!isRangeKey(range)) {
      return Response.json({ error: `Unsupported range: ${range}` }, { status: 400 });
    }

    const payload = await cached(`candles:${symbol}:${range}`, TTL_MS, () =>
      fetchCandles(symbol, range),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Candle request failed: ${detail}` }, { status: 502 });
  }
}