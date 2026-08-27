import type { NextRequest } from "next/server";
import { getBursaAnnouncements } from "@/lib/bursa-announcements";
import { toCompanyFilings } from "@/lib/bursa-filings";
import { cached } from "@/lib/cache";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const entry = entryBySymbol(symbol);

  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  try {
    const announcements = await cached(`bursa-announcements:v8:${entry.symbol}`, TTL_MS, () =>
      getBursaAnnouncements(entry),
    );
    const payload = toCompanyFilings(announcements, entry);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Filings request failed: ${detail}` }, { status: 502 });
  }
}
