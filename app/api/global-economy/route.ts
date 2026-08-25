import { cached } from "@/lib/cache";
import { getGlobalEconomySnapshot } from "@/lib/global-economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cached("global-economy:v2", TTL_MS, getGlobalEconomySnapshot);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Global economy request failed: ${detail}` }, { status: 502 });
  }
}
