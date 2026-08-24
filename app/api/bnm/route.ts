import type { NextRequest } from "next/server";
import { getBnmSnapshot, normalizeSession } from "@/lib/bnm";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// BNM publishes reference rates once per session, so a long TTL is safe.
const TTL_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = normalizeSession(request.nextUrl.searchParams.get("session"));

  try {
    const payload = await cached(`bnm:${session}:v2`, TTL_MS, () => getBnmSnapshot(session));
    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `BNM request failed: ${detail}` }, { status: 502 });
  }
}
