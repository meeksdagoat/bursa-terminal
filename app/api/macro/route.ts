import { cached } from "@/lib/cache";
import { getMacroSnapshot } from "@/lib/macro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Policy announcements move slower than market news.
const TTL_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const payload = await cached("macro", TTL_MS, getMacroSnapshot);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Macro request failed: ${detail}` }, { status: 502 });
  }
}
