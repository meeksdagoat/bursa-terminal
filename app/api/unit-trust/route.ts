import { cachedKeepLast } from "@/lib/cache";
import { buildUnitTrustPayload } from "@/lib/unit-trust/build-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_KEY = "unit-trust:fimm:v1";
/** FIMM publishes once per business day; refresh hourly. */
const TTL_MS = 60 * 60 * 1000;

/** Live Malaysian unit trust NAVs (FIMM) with distribution history. */
export async function GET() {
  try {
    const payload = await cachedKeepLast(CACHE_KEY, TTL_MS, () => buildUnitTrustPayload());
    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=900" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Unit trust feed failed: ${detail}` }, { status: 502 });
  }
}
