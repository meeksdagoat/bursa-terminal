import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { DEFAULT_CATEGORY, isHeadlineCategory } from "@/lib/categories";
import { getHeadlines } from "@/lib/headlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google News republishes on a few-minute cadence; polling harder only burns quota.
const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("category");
  const category = isHeadlineCategory(requested) ? requested : DEFAULT_CATEGORY;

  try {
    const payload = await cached(`headlines:v5:${category}`, TTL_MS, () => getHeadlines(category));
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Headline request failed: ${detail}` }, { status: 502 });
  }
}
