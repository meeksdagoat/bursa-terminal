import { getGlobalTickers } from "@/lib/tradingview-quote-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getGlobalTickers();
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Global ticker request failed: ${detail}` }, { status: 502 });
  }
}
