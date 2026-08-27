import { cachedKeepLast } from "@/lib/cache";
import { fallbackNewsPayload } from "@/lib/news-fallback";
import { getNewsSnapshot } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google News republishes on a few-minute cadence; polling harder only burns quota.
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cachedKeepLast("news:v3", TTL_MS, getNewsSnapshot);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(fallbackNewsPayload(), { headers: { "Cache-Control": "no-store" } });
  }
}
