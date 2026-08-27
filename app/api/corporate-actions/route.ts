import { getCorporateActionsPayload } from "@/lib/corporate-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const payload = await getCorporateActionsPayload();
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Corporate actions request failed: ${detail}` }, { status: 502 });
  }
}
