import type { NextRequest } from "next/server";

import { cached } from "@/lib/cache";
import { isUsTickerSymbol } from "@/constants/usTickers";
import { isQuantHubSymbol } from "@/lib/quant/asset-catalog";
import {
  alignFxRatesToDates,
  buildFxDateMap,
  computeDcaWindow,
  dcaNeedsFxConversion,
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

function filterPointsToWindow<T extends { time: number; close: number }>(
  rows: T[],
  startDate: string,
  endDate: string,
): T[] {
  return rows.filter((row) => {
    const date = unixToDate(row.time);
    return date >= startDate && date <= endDate;
  });
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
  const { startDate, endDate, periodMonths } = computeDcaWindow(period);
  const fromDate = new Date(`${startDate}T00:00:00+08:00`);

  const cacheKey = `dca-simulator:${symbol}:${frequency}:${period}:${baseCurrency}:${investmentAmount}:${startDate}`;

  try {
    const payload = await cached(cacheKey, TTL_MS, async () => {
      const history = await fetchAssetHistory(symbol, fromDate);
      const points = filterPointsToWindow(
        history.points.filter((row) => Number.isFinite(row.close) && row.close > 0),
        startDate,
        endDate,
      );

      if (points.length < 2) {
        const empty: DCASimulatorPayload = {
          symbol,
          frequency,
          period,
          baseCurrency,
          investmentAmount,
          asOf: new Date().toISOString(),
          startDate,
          endDate,
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
          warning: `Insufficient daily history for ${symbol} between ${startDate} and ${endDate}.`,
        };
        return empty;
      }

      const dates = points.map((row) => unixToDate(row.time));
      const closes = points.map((row) => row.close);

      let fxRates: number[] | undefined;
      let warning: string | null = null;

      if (dcaNeedsFxConversion(symbol, baseCurrency)) {
        const fxHistory = await fetchAssetHistory(USD_MYR_FX_SYMBOL, fromDate);
        const fxPoints = filterPointsToWindow(
          fxHistory.points.filter((row) => Number.isFinite(row.close) && row.close > 0),
          startDate,
          endDate,
        );
        const fxMap = buildFxDateMap(fxPoints.map((row) => ({ time: row.time, close: row.close })));
        const fallback = [...fxMap.values()].at(-1) ?? (baseCurrency === "MYR" ? 4.45 : 1);
        fxRates = alignFxRatesToDates(dates, fxMap, fallback);
        if (fxPoints.length === 0) {
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
        startDate,
        endDate,
        periodMonths,
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
        startDate,
        endDate,
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
