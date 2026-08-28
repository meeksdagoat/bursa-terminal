import { cached } from "@/lib/cache";
import { getQuantHubPayload } from "@/lib/quant/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cached("quant-hub:v2", TTL_MS, getQuantHubPayload);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Quant Hub request failed: ${detail}` }, { status: 502 });
  }
}
