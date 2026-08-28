import "server-only";

import { fetchDailyCloses } from "@/lib/yahoo";
import {
  alignReturns,
  calendarDaysForTradingWindow,
  closesByDate,
  dailyReturns,
  daysAgo,
  MIN_CORRELATION_SAMPLES,
  rollingPearsonOnMaps,
} from "./math";
import { buildFactorSeries } from "./series";
import type { QuantSeriesFactorId } from "./types";

export type CorrelationWindowDays = 30 | 60 | 90;

export type CorrelationSeriesPoint = {
  date: string;
  factorValue: number | null;
  price: number | null;
  volume: number | null;
};

export type RollingPearsonMetrics = {
  activeWindow: CorrelationWindowDays;
  pearsonR: number | null;
  pearsonR30: number | null;
  pearsonR60: number | null;
  pearsonR90: number | null;
  alignedTradingDays: number;
};

export type BuildCorrelationResult = {
  points: CorrelationSeriesPoint[];
  metrics: RollingPearsonMetrics;
  errors: string[];
  status: "live" | "degraded" | "fallback";
};

const MAX_ROLLING_WINDOW: CorrelationWindowDays = 90;
const FETCH_BUFFER_DAYS = 35;

/** Rolling Pearson r between factor levels and symbol daily returns. */
export function computeRollingPearsonMetrics(
  factorByDate: Map<string, number>,
  returnsByDate: Map<string, number>,
  activeWindow: CorrelationWindowDays,
): RollingPearsonMetrics {
  const aligned = alignReturns(factorByDate, returnsByDate);

  return {
    activeWindow,
    pearsonR: rollingPearsonOnMaps(factorByDate, returnsByDate, activeWindow),
    pearsonR30: rollingPearsonOnMaps(factorByDate, returnsByDate, 30),
    pearsonR60: rollingPearsonOnMaps(factorByDate, returnsByDate, 60),
    pearsonR90: rollingPearsonOnMaps(factorByDate, returnsByDate, 90),
    alignedTradingDays: aligned.dates.length,
  };
}

export async function buildCorrelationPayload(
  factorId: QuantSeriesFactorId,
  symbol: string,
  windowDays: CorrelationWindowDays,
): Promise<BuildCorrelationResult> {
  const errors: string[] = [];
  const lookbackCalendarDays = calendarDaysForTradingWindow(
    Math.max(windowDays, MAX_ROLLING_WINDOW),
  );
  const fetchFrom = daysAgo(lookbackCalendarDays + FETCH_BUFFER_DAYS);

  const [factorResult, closes] = await Promise.all([
    buildFactorSeries(factorId, lookbackCalendarDays, symbol),
    fetchDailyCloses(symbol, fetchFrom).catch((error) => {
      errors.push(error instanceof Error ? error.message : String(error));
      return [];
    }),
  ]);

  errors.push(...factorResult.errors);

  const priceMap = closesByDate(closes);
  const returnMap = dailyReturns(closes);
  const aligned = alignReturns(factorResult.series, returnMap);
  const metrics = computeRollingPearsonMetrics(factorResult.series, returnMap, windowDays);

  if (metrics.alignedTradingDays < MIN_CORRELATION_SAMPLES) {
    errors.push(
      `Only ${metrics.alignedTradingDays} aligned trading days — need at least ${MIN_CORRELATION_SAMPLES} for Pearson r`,
    );
  }

  const tailDates = aligned.dates.slice(-windowDays);
  const points: CorrelationSeriesPoint[] = tailDates.map((date) => ({
    date,
    factorValue: factorResult.series.get(date) ?? null,
    price: priceMap.get(date) ?? null,
    volume: null,
  }));

  return {
    points,
    metrics,
    errors,
    status: factorResult.status === "fallback" || closes.length === 0 ? "fallback" : factorResult.status,
  };
}
