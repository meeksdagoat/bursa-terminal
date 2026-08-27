import { cached } from "@/lib/cache";
import { ANNOUNCEMENTS_TTL_MS, getAnnouncementsFeed } from "@/lib/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const payload = await cached("announcements:bursa:v1", ANNOUNCEMENTS_TTL_MS, getAnnouncementsFeed);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Announcements request failed: ${detail}` }, { status: 502 });
  }
}
