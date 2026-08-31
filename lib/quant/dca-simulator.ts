/** Dollar-cost averaging simulation — client-safe types and pure engine. */

import { unixToDate } from "@/lib/quant/math";
import {
  resolveSymbolCurrency,
  type FrontierBaseCurrency,
} from "@/lib/quant/portfolio";
import type { QuantAssetCurrency } from "@/lib/quant/asset-catalog";

export const USD_MYR_FX_SYMBOL = "USDMYR=X";

export const DCA_FREQUENCIES = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-Weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

export type DCAFrequency = (typeof DCA_FREQUENCIES)[number]["id"];

export const DCA_PERIODS = [
  { id: "6m", label: "6M", calendarDays: 183 },
  { id: "1y", label: "1Y", calendarDays: 365 },
  { id: "2y", label: "2Y", calendarDays: 365 * 2 },
  { id: "3y", label: "3Y", calendarDays: 365 * 3 },
  { id: "5y", label: "5Y", calendarDays: 365 * 5 },
  { id: "10y", label: "10Y", calendarDays: 365 * 10 },
] as const;

export type DCAPeriod = (typeof DCA_PERIODS)[number]["id"];

export type DCABaseCurrency = FrontierBaseCurrency;

export type DCASimulatorPoint = {
  timestamp: string;
  cumulativeInvested: number;
  portfolioValue: number;
  unitPrice: number;
  totalUnits: number;
};

export type DCASimulatorSummary = {
  totalCapitalInvested: number;
  currentPortfolioValue: number;
  totalProfitLoss: number;
  totalReturnPct: number;
  averageCostBasis: number;
  currentPrice: number;
  totalUnits: number;
  contributionCount: number;
};

export type DCASimulatorPayload = {
  symbol: string;
  frequency: DCAFrequency;
  period: DCAPeriod;
  baseCurrency: DCABaseCurrency;
  investmentAmount: number;
  asOf: string;
  points: DCASimulatorPoint[];
  summary: DCASimulatorSummary;
  warning: string | null;
};

const FREQUENCY_IDS = new Set<string>(DCA_FREQUENCIES.map((row) => row.id));
const PERIOD_IDS = new Set<string>(DCA_PERIODS.map((row) => row.id));

export function isDCAFrequency(value: string | null): value is DCAFrequency {
  return typeof value === "string" && FREQUENCY_IDS.has(value);
}

export function isDCAPeriod(value: string | null): value is DCAPeriod {
  return typeof value === "string" && PERIOD_IDS.has(value);
}

export function dcaPeriodCalendarDays(period: DCAPeriod): number {
  return DCA_PERIODS.find((row) => row.id === period)?.calendarDays ?? 365 * 2;
}

export function dcaNeedsFxConversion(symbol: string, baseCurrency: DCABaseCurrency): boolean {
  return resolveSymbolCurrency(symbol) !== baseCurrency;
}

function convertPriceToBase(
  price: number,
  assetCurrency: QuantAssetCurrency,
  baseCurrency: DCABaseCurrency,
  usdMyrRate: number,
): number {
  if (assetCurrency === baseCurrency || assetCurrency === "POINTS") return price;
  if (baseCurrency === "MYR" && assetCurrency === "USD") return price * usdMyrRate;
  if (baseCurrency === "USD" && assetCurrency === "MYR") {
    return usdMyrRate > 0 ? price / usdMyrRate : price;
  }
  return price;
}

function shouldContribute(
  date: string,
  lastContributionDate: string | null,
  frequency: DCAFrequency,
): boolean {
  if (lastContributionDate == null) return true;
  if (frequency === "daily") return true;

  const currentMs = Date.parse(`${date}T12:00:00+08:00`);
  const previousMs = Date.parse(`${lastContributionDate}T12:00:00+08:00`);
  const dayGap = (currentMs - previousMs) / 86_400_000;

  if (frequency === "weekly") return dayGap >= 7;
  if (frequency === "biweekly") return dayGap >= 14;

  const current = new Date(currentMs);
  const previous = new Date(previousMs);
  return (
    current.getUTCFullYear() !== previous.getUTCFullYear() ||
    current.getUTCMonth() !== previous.getUTCMonth()
  );
}

export function alignFxRatesToDates(
  dates: string[],
  fxByDate: Map<string, number>,
  fallback: number,
): number[] {
  let last = fallback;
  return dates.map((date) => {
    if (fxByDate.has(date)) last = fxByDate.get(date)!;
    return last;
  });
}

export function buildFxDateMap(
  points: Array<{ time: number; close: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) {
    if (!Number.isFinite(point.close) || point.close <= 0) continue;
    map.set(unixToDate(point.time), point.close);
  }
  return map;
}

export function runDCASimulation(input: {
  dates: string[];
  closes: number[];
  fxRates?: number[];
  assetCurrency: QuantAssetCurrency;
  baseCurrency: DCABaseCurrency;
  investmentAmount: number;
  frequency: DCAFrequency;
}): { points: DCASimulatorPoint[]; summary: DCASimulatorSummary } {
  const { dates, closes, investmentAmount, frequency, baseCurrency, assetCurrency } = input;
  const fxRates = input.fxRates ?? dates.map(() => 1);

  let totalUnits = 0;
  let cumulativeInvested = 0;
  let contributionCount = 0;
  let lastContributionDate: string | null = null;
  const points: DCASimulatorPoint[] = [];

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    const nativeClose = closes[index] ?? 0;
    const fx = fxRates[index] ?? 1;
    const unitPrice =
      nativeClose > 0
        ? convertPriceToBase(nativeClose, assetCurrency, baseCurrency, fx)
        : 0;

    if (unitPrice > 0 && shouldContribute(date, lastContributionDate, frequency)) {
      totalUnits += investmentAmount / unitPrice;
      cumulativeInvested += investmentAmount;
      contributionCount += 1;
      lastContributionDate = date;
    }

    const portfolioValue = totalUnits * unitPrice;

    points.push({
      timestamp: date,
      cumulativeInvested,
      portfolioValue,
      unitPrice,
      totalUnits,
    });
  }

  const lastPoint = points.at(-1);
  const totalCapitalInvested = lastPoint?.cumulativeInvested ?? 0;
  const currentPortfolioValue = lastPoint?.portfolioValue ?? 0;
  const totalProfitLoss = currentPortfolioValue - totalCapitalInvested;
  const totalReturnPct =
    totalCapitalInvested > 0 ? (totalProfitLoss / totalCapitalInvested) * 100 : 0;
  const totalUnitsFinal = lastPoint?.totalUnits ?? 0;
  const currentPrice = lastPoint?.unitPrice ?? 0;
  const averageCostBasis =
    totalUnitsFinal > 0 ? totalCapitalInvested / totalUnitsFinal : 0;

  return {
    points,
    summary: {
      totalCapitalInvested,
      currentPortfolioValue,
      totalProfitLoss,
      totalReturnPct,
      averageCostBasis,
      currentPrice,
      totalUnits: totalUnitsFinal,
      contributionCount,
    },
  };
}
