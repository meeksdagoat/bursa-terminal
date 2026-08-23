import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { isRangeKey } from "@/lib/ranges";
import { KLCI_SYMBOL, universeSymbols } from "@/lib/universe";
import { fetchCandles } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 60 * 1000;
const ALLOWED_SYMBOLS = new Set([...universeSymbols, KLCI_SYMBOL]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") ?? "";
  const range = searchParams.get("range") ?? "1M";

  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }
  if (!isRangeKey(range)) {
    return Response.json({ error: `Unsupported range: ${range}` }, { status: 400 });
  }

  try {
    const payload = await cached(`candles:${symbol}:${range}`, TTL_MS, () =>
      fetchCandles(symbol, range),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Candle request failed: ${detail}` }, { status: 502 });
  }
}
