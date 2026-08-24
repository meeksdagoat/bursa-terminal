import { cached } from "@/lib/cache";
import { getBnmSnapshot, DEFAULT_SESSION } from "@/lib/bnm";
import { getEconomySnapshot } from "@/lib/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;

export async function GET() {
  try {
      const payload = await cached("economy:v4", TTL_MS, async () => {
      const bnm = await getBnmSnapshot(DEFAULT_SESSION);
      const usd = bnm.rates.find((rate) => rate.currencyCode === "USD")?.rate ?? null;
      return getEconomySnapshot(usd);
    });
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Economy request failed: ${detail}` }, { status: 502 });
  }
}
