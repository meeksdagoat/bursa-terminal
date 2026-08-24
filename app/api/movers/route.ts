import { cached } from "@/lib/cache";
import { getMoversSnapshot } from "@/lib/movers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The scan costs several upstream batches, so every client shares one result
// per window; Bursa quotes are exchange-delayed anyway.
const TTL_MS = 60 * 1000;

export async function GET() {
  try {
    const payload = await cached("movers", TTL_MS, getMoversSnapshot);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Movers request failed: ${detail}` }, { status: 502 });
  }
}
