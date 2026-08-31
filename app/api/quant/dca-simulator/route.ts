import type { NextRequest } from "next/server";

import { cached } from "@/lib/cache";
import { isUsTickerSymbol } from "@/constants/usTickers";
import { isQuantHubSymbol } from "@/lib/quant/asset-catalog";
import {
  alignFxRatesToDates,
  buildFxDateMap,
  dcaNeedsFxConversion,
  dcaPeriodCalendarDays,
  isDCAFrequency,
  isDCAPeriod,
  runDCASimulation,
  USD_MYR_FX_SYMBOL,
  type DCABaseCurrency,
  type DCAFrequency,
  type DCAPeriod,
  type DCASimulatorPayload,
} from "@/lib/quant/dca-simulator";
import { fetchAssetHistory } from "@/lib/quant/fetchAssetHistory";
import { unixToDate } from "@/lib/quant/math";
import { resolveSymbolCurrency } from "@/lib/quant/portfolio";
import { isTrackedSymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;
const DEFAULT_INVESTMENT_AMOUNT = 500;
const MIN_INVESTMENT_AMOUNT = 1;

function isAllowedSymbol(symbol: string): boolean {
  const trimmed = symbol.trim();
  if (!trimmed) return false;

  const benchmarkAllowlist = new Set([
    "^KLSE",
    "^GSPC",
    "QQQ",
    "GC=F",
    "XAUUSD=X",
    "BZ=F",
    "CL=F",
    "USDMYR=X",
    "BTC-USD",
    "SI=F",
    "GLD",
    "SLV",
  ]);

  return (
    isTrackedSymbol(trimmed) ||
    benchmarkAllowlist.has(trimmed) ||
    isQuantHubSymbol(trimmed) ||
    isUsTickerSymbol(trimmed)
  );
}

function parseInvestmentAmount(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < MIN_INVESTMENT_AMOUNT) {
    return DEFAULT_INVESTMENT_AMOUNT;
  }
  return parsed;
}

function parseBaseCurrency(raw: string | null): DCABaseCurrency {
  return raw === "USD" ? "USD" : "MYR";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "").trim();
  const frequencyRaw = searchParams.get("frequency") ?? "monthly";
  const periodRaw = searchParams.get("period") ?? "2y";
  const baseCurrency = parseBaseCurrency(searchParams.get("baseCurrency"));
  const investmentAmount = parseInvestmentAmount(searchParams.get("amount"));

  if (!symbol) {
    return Response.json({ error: "Missing symbol parameter" }, { status: 400 });
  }

  if (!isAllowedSymbol(symbol)) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  const frequency: DCAFrequency = isDCAFrequency(frequencyRaw) ? frequencyRaw : "monthly";
  const period: DCAPeriod = isDCAPeriod(periodRaw) ? periodRaw : "2y";
  const calendarDays = dcaPeriodCalendarDays(period);
  const fromDate = new Date(Date.now() - calendarDays * 86_400_000);

  const cacheKey = `dca-simulator:${symbol}:${frequency}:${period}:${baseCurrency}:${investmentAmount}`;

  try {
    const payload = await cached(cacheKey, TTL_MS, async () => {
      const history = await fetchAssetHistory(symbol, fromDate);
      const points = history.points.filter((row) => Number.isFinite(row.close) && row.close > 0);

      if (points.length < 20) {
        const empty: DCASimulatorPayload = {
          symbol,
          frequency,
          period,
          baseCurrency,
          investmentAmount,
          asOf: new Date().toISOString(),
          points: [],
          summary: {
            totalCapitalInvested: 0,
            currentPortfolioValue: 0,
            totalProfitLoss: 0,
            totalReturnPct: 0,
            averageCostBasis: 0,
            currentPrice: 0,
            totalUnits: 0,
            contributionCount: 0,
          },
          warning: `Insufficient daily history for ${symbol} over ${period.toUpperCase()}.`,
        };
        return empty;
      }

      const dates = points.map((row) => unixToDate(row.time));
      const closes = points.map((row) => row.close);

      let fxRates: number[] | undefined;
      let warning: string | null = null;

      if (dcaNeedsFxConversion(symbol, baseCurrency)) {
        const fxHistory = await fetchAssetHistory(USD_MYR_FX_SYMBOL, fromDate);
        const fxMap = buildFxDateMap(
          fxHistory.points.map((row) => ({ time: row.time, close: row.close })),
        );
        const fallback = [...fxMap.values()].at(-1) ?? (baseCurrency === "MYR" ? 4.45 : 1);
        fxRates = alignFxRatesToDates(dates, fxMap, fallback);
        if (fxHistory.points.length === 0) {
          warning = `FX series ${USD_MYR_FX_SYMBOL} unavailable — using fallback rate ${fallback.toFixed(4)}.`;
        }
      }

      const assetCurrency = resolveSymbolCurrency(symbol);
      const { points: series, summary } = runDCASimulation({
        dates,
        closes,
        fxRates,
        assetCurrency,
        baseCurrency,
        investmentAmount,
        frequency,
      });

      if (summary.contributionCount === 0) {
        warning = warning ?? "No contributions executed — widen period or change frequency.";
      }

      return {
        symbol,
        frequency,
        period,
        baseCurrency,
        investmentAmount,
        asOf: new Date().toISOString(),
        points: series,
        summary,
        warning,
      } satisfies DCASimulatorPayload;
    });

    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DCA simulation failed";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
