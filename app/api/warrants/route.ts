import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { entryBySymbol } from "@/lib/universe";
import { getStructuredWarrants } from "@/lib/warrants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const entry = entryBySymbol(symbol);

  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  try {
    const payload = await cached(`warrants:v2:${entry.symbol}`, TTL_MS, () =>
      getStructuredWarrants(entry),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Warrants request failed: ${detail}` }, { status: 502 });
  }
}
