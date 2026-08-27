import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getAnnouncementDetail, isAnnouncementId } from "@/lib/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isAnnouncementId(id)) {
    return Response.json({ error: `Invalid announcement id: ${id}` }, { status: 400 });
  }

  try {
    const payload = await cached(`announcement:detail:v3:${id}`, 10 * 60 * 1000, () =>
      getAnnouncementDetail(id),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Announcement detail failed: ${detail}` }, { status: 502 });
  }
}
