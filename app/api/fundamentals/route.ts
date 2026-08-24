import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getCompanyFundamentals } from "@/lib/fundamentals";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const entry = entryBySymbol(symbol);

  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  try {
    const payload = await cached(`fundamentals:yahoo:v2:${entry.symbol}`, TTL_MS, () =>
      getCompanyFundamentals(entry),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Fundamentals request failed: ${detail}` }, { status: 502 });
  }
}
