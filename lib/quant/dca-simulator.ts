/** Dollar-cost averaging simulation — client-safe types and pure engine. */

import { klIsoDate, unixToDate } from "@/lib/quant/math";
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
  { id: "6m", label: "6M", calendarDays: 183, months: 6 },
  { id: "1y", label: "1Y", calendarDays: 365, months: 12 },
  { id: "2y", label: "2Y", calendarDays: 365 * 2, months: 24 },
  { id: "3y", label: "3Y", calendarDays: 365 * 3, months: 36 },
  { id: "5y", label: "5Y", calendarDays: 365 * 5, months: 60 },
  { id: "10y", label: "10Y", calendarDays: 365 * 10, months: 120 },
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
  startDate: string;
  endDate: string;
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

export function dcaPeriodMonths(period: DCAPeriod): number {
  return DCA_PERIODS.find((row) => row.id === period)?.months ?? 24;
}

/** Exact calendar-month lookback window ending on `endDate` (MYT calendar dates). */
export function computeDcaWindow(
  period: DCAPeriod,
  endDate: Date = new Date(),
): { startDate: string; endDate: string; periodMonths: number } {
  const periodMonths = dcaPeriodMonths(period);
  const endDateIso = klIsoDate(endDate);
  const startDate = subtractMonthsIso(endDateIso, periodMonths);
  return { startDate, endDate: endDateIso, periodMonths };
}

function parseIsoParts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function formatIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function shiftMonthsIso(iso: string, deltaMonths: number): string {
  let { year, month, day } = parseIsoParts(iso);
  month += deltaMonths;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  const clampedDay = Math.min(day, daysInMonth(year, month));
  return formatIso(year, month, clampedDay);
}

export function subtractMonthsIso(iso: string, months: number): string {
  return shiftMonthsIso(iso, -months);
}

export function addMonthsIso(iso: string, months: number): string {
  return shiftMonthsIso(iso, months);
}

/** Deterministic contribution schedule — monthly yields exactly `periodMonths` dates. */
export function generateContributionTargets(
  startDate: string,
  endDate: string,
  frequency: DCAFrequency,
  periodMonths: number,
): string[] {
  if (frequency === "monthly") {
    const targets: string[] = [];
    let current = startDate;
    for (let index = 0; index < periodMonths; index += 1) {
      targets.push(current);
      current = addMonthsIso(current, 1);
    }
    return targets;
  }

  if (frequency === "daily") {
    return [];
  }

  const stepDays = frequency === "weekly" ? 7 : 14;
  const targets: string[] = [];
  let cursor = parseIsoMs(startDate);
  const endMs = parseIsoMs(endDate);

  while (cursor <= endMs) {
    targets.push(klIsoDate(new Date(cursor)));
    cursor += stepDays * 86_400_000;
  }

  return targets;
}

function parseIsoMs(iso: string): number {
  return Date.parse(`${iso}T12:00:00+08:00`);
}

/** First trading day on or after `target`; falls back to the closest prior session. */
export function resolveContributionTradingDate(
  target: string,
  tradingDates: readonly string[],
): string | null {
  if (tradingDates.length === 0) return null;

  let lo = 0;
  let hi = tradingDates.length - 1;
  let onOrAfter: string | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = tradingDates[mid]!;
    if (candidate >= target) {
      onOrAfter = candidate;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  if (onOrAfter) return onOrAfter;

  for (let index = tradingDates.length - 1; index >= 0; index -= 1) {
    const candidate = tradingDates[index]!;
    if (candidate <= target) return candidate;
  }

  return null;
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

function buildContributionSchedule(input: {
  tradingDates: readonly string[];
  startDate: string;
  endDate: string;
  frequency: DCAFrequency;
  periodMonths: number;
}): Map<string, number> {
  const schedule = new Map<string, number>();

  if (input.frequency === "daily") {
    for (const date of input.tradingDates) {
      if (date >= input.startDate && date <= input.endDate) {
        schedule.set(date, 1);
      }
    }
    return schedule;
  }

  const targets = generateContributionTargets(
    input.startDate,
    input.endDate,
    input.frequency,
    input.periodMonths,
  );

  for (const target of targets) {
    const tradingDate = resolveContributionTradingDate(target, input.tradingDates);
    if (!tradingDate || tradingDate < input.startDate || tradingDate > input.endDate) continue;
    schedule.set(tradingDate, (schedule.get(tradingDate) ?? 0) + 1);
  }

  return schedule;
}

export function runDCASimulation(input: {
  dates: string[];
  closes: number[];
  fxRates?: number[];
  assetCurrency: QuantAssetCurrency;
  baseCurrency: DCABaseCurrency;
  investmentAmount: number;
  frequency: DCAFrequency;
  startDate: string;
  endDate: string;
  periodMonths: number;
}): { points: DCASimulatorPoint[]; summary: DCASimulatorSummary } {
  const {
    dates,
    closes,
    investmentAmount,
    frequency,
    baseCurrency,
    assetCurrency,
    startDate,
    endDate,
    periodMonths,
  } = input;
  const fxRates = input.fxRates ?? dates.map(() => 1);

  const contributionSchedule = buildContributionSchedule({
    tradingDates: dates,
    startDate,
    endDate,
    frequency,
    periodMonths,
  });

  let totalUnits = 0;
  let cumulativeInvested = 0;
  let contributionCount = 0;
  const points: DCASimulatorPoint[] = [];

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    const nativeClose = closes[index] ?? 0;
    const fx = fxRates[index] ?? 1;
    const unitPrice =
      nativeClose > 0
        ? convertPriceToBase(nativeClose, assetCurrency, baseCurrency, fx)
        : 0;

    const purchases = contributionSchedule.get(date) ?? 0;
    if (unitPrice > 0 && purchases > 0) {
      totalUnits += (investmentAmount * purchases) / unitPrice;
      cumulativeInvested += investmentAmount * purchases;
      contributionCount += purchases;
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
