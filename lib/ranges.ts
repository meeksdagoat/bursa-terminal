/** Client-safe chart range constants; keep free of server-only imports. */

export const RANGE_KEYS = ["1D", "5D", "1W", "1M", "3M", "6M", "1Y", "ALL"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export function isRangeKey(value: string | null): value is RangeKey {
  return RANGE_KEYS.includes(value as RangeKey);
}

/** Timeframes shown on the main stock chart. */
export const CHART_TIMEFRAMES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export function isChartTimeframe(value: string | null): value is ChartTimeframe {
  return CHART_TIMEFRAMES.includes(value as ChartTimeframe);
}

export const CHART_TYPES = ["candlestick", "line", "heikin-ashi"] as const;

export type ChartType = (typeof CHART_TYPES)[number];

/** TradingView-style chart resolutions shown in the interval bar. */
export const INTERVAL_KEYS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"] as const;

export type IntervalKey = (typeof INTERVAL_KEYS)[number];

export function isIntervalKey(value: string | null): value is IntervalKey {
  return INTERVAL_KEYS.includes(value as IntervalKey);
}
