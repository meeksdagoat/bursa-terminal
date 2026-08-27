import { cachedKeepLast } from "@/lib/cache";
import { fallbackHeadlinesPayload } from "@/lib/news-fallback";
import { getHeadlines } from "@/lib/headlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cachedKeepLast("headlines:v6:global-economy", TTL_MS, () =>
      getHeadlines("global-economy"),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(fallbackHeadlinesPayload("global-economy"), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
