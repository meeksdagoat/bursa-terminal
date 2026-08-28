import type { NextRequest } from "next/server";
import { cachedKeepLast } from "@/lib/cache";
import { fallbackHeadlinesPayload } from "@/lib/news-fallback";
import { fetchGlobalPoliticsNews } from "@/lib/geopolitics/global-politics-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function GET(_request: NextRequest) {
  try {
    const payload = await cachedKeepLast("headlines:v7:global-politics", TTL_MS, () =>
      fetchGlobalPoliticsNews(),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const fallback = fallbackHeadlinesPayload("world-politics");
    return Response.json(
      {
        ...fallback,
        byIso2: {},
        matchedCountries: 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
