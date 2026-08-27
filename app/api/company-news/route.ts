import type { NextRequest } from "next/server";
import { cachedKeepLast } from "@/lib/cache";
import { fallbackNewsPayload } from "@/lib/news-fallback";
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
    const payload = await cachedKeepLast(`company-news:v3:${entry.symbol}`, TTL_MS, () =>
      getCompanyNews(entry),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { ...fallbackNewsPayload(), symbol: entry.symbol, company: entry.name },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
