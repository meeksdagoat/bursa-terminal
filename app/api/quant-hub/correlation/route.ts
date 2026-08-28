import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { buildCorrelationPayload } from "@/lib/quant/correlation";
import { assessSeriesFactorRelevance } from "@/lib/quant/sector-relevance";
import type { QuantCorrelationPayload, QuantSeriesFactorId } from "@/lib/quant/types";
import { QUANT_FACTOR_OPTIONS } from "@/lib/quant/types";
import { formatStockOptionLabel, formatStockPriceLabel } from "@/lib/stock-names";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TTL_MS = 5 * 60 * 1000;

const FACTOR_IDS = new Set<string>(QUANT_FACTOR_OPTIONS.map((option) => option.id));

function parseWindow(raw: string | null): 30 | 60 | 90 {
  if (raw === "60") return 60;
  if (raw === "90") return 90;
  return 30;
}

export async function GET(request: NextRequest) {
  const factorId = request.nextUrl.searchParams.get("factor") ?? "rainfall";
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "2445.KL";
  const windowDays = parseWindow(request.nextUrl.searchParams.get("window"));

  if (!FACTOR_IDS.has(factorId)) {
    return Response.json({ error: `Unsupported factor: ${factorId}` }, { status: 400 });
  }

  const entry = entryBySymbol(symbol);
  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  const factorMeta = QUANT_FACTOR_OPTIONS.find((option) => option.id === factorId)!;
  const cacheKey = `quant-corr:v5:${factorId}:${symbol}:${windowDays}`;

  try {
    const correlation = await cached(cacheKey, TTL_MS, () =>
      buildCorrelationPayload(factorId as QuantSeriesFactorId, symbol, windowDays),
    );

    const sectorRelevance = assessSeriesFactorRelevance(
      factorId as QuantSeriesFactorId,
      entry.sector,
    );

    const payload: QuantCorrelationPayload = {
      asOf: new Date().toISOString(),
      factorId: factorId as QuantSeriesFactorId,
      factorLabel: factorMeta.label,
      factorUnit: factorMeta.unit,
      symbol,
      symbolLabel: formatStockOptionLabel(symbol),
      priceSeriesLabel: formatStockPriceLabel(symbol),
      targetSector: entry.sector,
      sectorRelevance: {
        level: sectorRelevance.level,
        message: sectorRelevance.message,
      },
      windowDays,
      pearsonR: correlation.metrics.pearsonR,
      pearsonR30: correlation.metrics.pearsonR30,
      pearsonR60: correlation.metrics.pearsonR60,
      pearsonR90: correlation.metrics.pearsonR90,
      alignedTradingDays: correlation.metrics.alignedTradingDays,
      points: correlation.points,
      status: correlation.status,
      errors: correlation.errors,
    };

    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Correlation request failed: ${detail}` }, { status: 502 });
  }
}
