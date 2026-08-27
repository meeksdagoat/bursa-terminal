import { cachedKeepLast } from "@/lib/cache";
import { fallbackOfficialPayload } from "@/lib/news-fallback";
import { getOfficialWire } from "@/lib/official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cachedKeepLast("official-wire:v3", TTL_MS, () => getOfficialWire());
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(fallbackOfficialPayload(), { headers: { "Cache-Control": "no-store" } });
  }
}
