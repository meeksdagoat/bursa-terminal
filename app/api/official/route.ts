import { cached } from "@/lib/cache";
import { getOfficialWire } from "@/lib/official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cached("official-wire:v2", TTL_MS, () => getOfficialWire());
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Official wire failed: ${detail}` }, { status: 502 });
  }
}
