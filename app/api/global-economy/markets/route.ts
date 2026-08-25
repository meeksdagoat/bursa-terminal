import { cached } from "@/lib/cache";
import { getGlobalMarketQuotes } from "@/lib/global-economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 3 * 1000;

export async function GET() {
  try {
    const payload = await cached("global-economy-markets:v1", TTL_MS, getGlobalMarketQuotes);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Global markets request failed: ${detail}` }, { status: 502 });
  }
}
