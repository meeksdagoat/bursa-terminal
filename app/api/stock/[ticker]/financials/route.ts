import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getFinancialStatements } from "@/lib/financial-statements";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 30 * 60 * 1000;

function resolveTicker(raw: string) {
  const ticker = decodeURIComponent(raw).trim();
  return entryBySymbol(ticker) ?? entryBySymbol(`${ticker}.KL`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const entry = resolveTicker(ticker);

  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${ticker}` }, { status: 400 });
  }

  try {
    const payload = await cached(`financials:yahoo:v3:${entry.symbol}`, TTL_MS, () =>
      getFinancialStatements(entry),
    );
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Financials request failed: ${detail}` }, { status: 502 });
  }
}
