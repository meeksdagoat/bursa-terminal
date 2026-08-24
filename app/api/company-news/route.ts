import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getCompanyNews } from "@/lib/company-news";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const entry = entryBySymbol(symbol);

  // Restricting to the tracked universe keeps an arbitrary query string from
  // becoming an unbounded cache key or an unbounded upstream search.
  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  try {
    const payload = await cached(`company-news:v2:${entry.symbol}`, TTL_MS, () =>
      getCompanyNews(entry),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Company news request failed: ${detail}` }, { status: 502 });
  }
}
