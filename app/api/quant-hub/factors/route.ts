import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { computeQuantFactorsForSymbol } from "@/lib/quant/symbol-factors";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "1155.KL";

  if (!entryBySymbol(symbol)) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  const cacheKey = `quant-factors:v1:${symbol}`;

  try {
    const payload = await cached(cacheKey, TTL_MS, () => computeQuantFactorsForSymbol(symbol));
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Symbol factor request failed: ${detail}` }, { status: 502 });
  }
}
