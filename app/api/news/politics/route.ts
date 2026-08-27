import type { NextRequest } from "next/server";
import { cachedKeepLast } from "@/lib/cache";
import type { HeadlineCategory } from "@/lib/categories";
import { fallbackHeadlinesPayload } from "@/lib/news-fallback";
import { getHeadlines } from "@/lib/headlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const world = request.nextUrl.searchParams.get("scope") === "world";
  const category: HeadlineCategory = world ? "world-politics" : "my-politics";

  try {
    const payload = await cachedKeepLast(`headlines:v6:${category}`, TTL_MS, () => getHeadlines(category));
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(fallbackHeadlinesPayload(category), { headers: { "Cache-Control": "no-store" } });
  }
}
