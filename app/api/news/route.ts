import { cached } from "@/lib/cache";
import { getNewsSnapshot } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google News republishes on a few-minute cadence; polling harder only burns quota.
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cached("news:v2", TTL_MS, getNewsSnapshot);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `News request failed: ${detail}` }, { status: 502 });
  }
}
