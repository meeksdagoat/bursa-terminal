/** Client-safe multi-timeframe backtest constants and formatting. */

/** Engine-internal lookback buckets used by metrics windows. */
export type BacktestLookbackId = "1y" | "3y" | "5y";

/** Timeframes shown in the Historical Backtest UI (intraday minutes excluded). */
export const HISTORICAL_BACKTEST_TIMEFRAMES = ["1H", "4H", "1D", "1W", "1M"] as const;

export type HistoricalBacktestTimeframe = (typeof HISTORICAL_BACKTEST_TIMEFRAMES)[number];

/** Engine/data-layer timeframes (includes legacy intraday for stored configs & API coercion). */
export const BACKTEST_TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  ...HISTORICAL_BACKTEST_TIMEFRAMES,
] as const;

export type BacktestTimeframe = (typeof BACKTEST_TIMEFRAMES)[number];

export const DEFAULT_CUSTOM_STRATEGY_TIMEFRAME: BacktestTimeframe = "1D";

export const BACKTEST_TIMEFRAME_OPTIONS: readonly {
  id: BacktestTimeframe;
  label: string;
}[] = HISTORICAL_BACKTEST_TIMEFRAMES.map((id) => ({ id, label: id }));

const REMOVED_UI_TIMEFRAMES = new Set<BacktestTimeframe>(["1m", "5m", "15m", "30m"]);

export type BacktestLookbackOptionId =
  | "30d"
  | "60d"
  | "180d"
  | "1y"
  | "1.5y"
  | "2y"
  | "3y"
  | "5y"
  | "10y"
  | "all";

export type BacktestDataProvider = "yahoo" | "parquet";

export const PARQUET_CACHED_TIMEFRAMES = ["15m", "30m"] as const;

export type ParquetCachedTimeframe = (typeof PARQUET_CACHED_TIMEFRAMES)[number];

export function isParquetCachedTimeframe(
  timeframe: BacktestTimeframe,
): timeframe is ParquetCachedTimeframe {
  return timeframe === "15m" || timeframe === "30m";
}

export type BacktestLookbackOption = {
  id: BacktestLookbackOptionId;
  label: string;
  calendarDays: number;
};

export const YAHOO_HOURLY_MAX_CALENDAR_DAYS = Math.round(365 * 1.5);
export const INTRADAY_MAX_CALENDAR_DAYS = 60;

/** @deprecated Use INTRADAY_MAX_CALENDAR_DAYS */
export const POLYGON_INTRADAY_MAX_CALENDAR_DAYS = INTRADAY_MAX_CALENDAR_DAYS;

const MINUTE_LOOKBACK_OPTIONS: readonly BacktestLookbackOption[] = [
  { id: "30d", label: "30D", calendarDays: 30 },
  { id: "60d", label: "60D", calendarDays: 60 },
];

const HOURLY_LOOKBACK_OPTIONS: readonly BacktestLookbackOption[] = [
  { id: "180d", label: "180D", calendarDays: 180 },
  { id: "1y", label: "1Y", calendarDays: 365 },
  { id: "1.5y", label: "1.5Y", calendarDays: Math.round(365 * 1.5) },
];

const DAILY_LOOKBACK_OPTIONS: readonly BacktestLookbackOption[] = [
  { id: "1y", label: "1Y", calendarDays: 365 },
  { id: "3y", label: "3Y", calendarDays: 365 * 3 },
  { id: "5y", label: "5Y", calendarDays: 365 * 5 },
  { id: "10y", label: "10Y", calendarDays: 365 * 10 },
  { id: "all", label: "ALL", calendarDays: 365 * 20 },
];

const LOOKBACK_OPTION_IDS = new Set<string>([
  "30d",
  "60d",
  "180d",
  "1y",
  "1.5y",
  "2y",
  "3y",
  "5y",
  "10y",
  "all",
]);

export function isBacktestTimeframe(value: string | null): value is BacktestTimeframe {
  return BACKTEST_TIMEFRAMES.includes(value as BacktestTimeframe);
}

export function isHistoricalBacktestTimeframe(
  value: string | null,
): value is HistoricalBacktestTimeframe {
  return (HISTORICAL_BACKTEST_TIMEFRAMES as readonly string[]).includes(value ?? "");
}

export function coerceHistoricalBacktestTimeframe(
  timeframe: BacktestTimeframe,
): HistoricalBacktestTimeframe {
  if (REMOVED_UI_TIMEFRAMES.has(timeframe)) return "1D";
  if (isHistoricalBacktestTimeframe(timeframe)) return timeframe;
  return "1D";
}

export function isBacktestLookbackOptionId(value: string | null): value is BacktestLookbackOptionId {
  return typeof value === "string" && LOOKBACK_OPTION_IDS.has(value);
}

export const BURSA_BACKTEST_TIMEFRAMES = ["1D", "1W", "1M"] as const;

export type BursaBacktestTimeframe = (typeof BURSA_BACKTEST_TIMEFRAMES)[number];

export function isBursaBacktestSymbol(symbol: string, category?: string): boolean {
  if (category === "bursa") return true;
  return symbol.trim().toUpperCase().endsWith(".KL");
}

export function getTimeframeOptionsForAsset(input: {
  symbol: string;
  category?: string;
}): readonly { id: BacktestTimeframe; label: string }[] {
  if (isBursaBacktestSymbol(input.symbol, input.category)) {
    return BACKTEST_TIMEFRAME_OPTIONS.filter((option) =>
      (BURSA_BACKTEST_TIMEFRAMES as readonly string[]).includes(option.id),
    );
  }
  return BACKTEST_TIMEFRAME_OPTIONS;
}

export function coerceTimeframeForAsset(
  timeframe: BacktestTimeframe,
  input: { symbol: string; category?: string },
): BacktestTimeframe {
  const normalized = REMOVED_UI_TIMEFRAMES.has(timeframe) ? "1D" : timeframe;
  const options = getTimeframeOptionsForAsset(input);
  if (options.some((option) => option.id === normalized)) return normalized;
  return "1D";
}

export function isIntradayBacktestTimeframe(timeframe: BacktestTimeframe): boolean {
  return (
    timeframe === "1m" ||
    timeframe === "5m" ||
    timeframe === "15m" ||
    timeframe === "30m" ||
    timeframe === "1H" ||
    timeframe === "4H"
  );
}

export function isHighDensityTimeframe(timeframe: BacktestTimeframe): boolean {
  return timeframe === "1m" || timeframe === "5m";
}

export function isYahooHourlyTimeframe(timeframe: BacktestTimeframe): boolean {
  return timeframe === "1H" || timeframe === "4H";
}

export function getBacktestDataProvider(timeframe: BacktestTimeframe): BacktestDataProvider {
  if (isParquetCachedTimeframe(timeframe)) return "parquet";
  return "yahoo";
}

export function getBacktestProviderStatusBadge(_timeframe?: BacktestTimeframe): string {
  return "Provider: Yahoo Finance / Internal Data Cache";
}

export function getLookbackOptionsForTimeframe(
  timeframe: BacktestTimeframe,
): readonly BacktestLookbackOption[] {
  if (isParquetCachedTimeframe(timeframe) || isHighDensityTimeframe(timeframe)) {
    return MINUTE_LOOKBACK_OPTIONS;
  }
  if (isYahooHourlyTimeframe(timeframe)) return HOURLY_LOOKBACK_OPTIONS;
  return DAILY_LOOKBACK_OPTIONS;
}

export function defaultLookbackForTimeframe(timeframe: BacktestTimeframe): BacktestLookbackOptionId {
  if (isParquetCachedTimeframe(timeframe) || isHighDensityTimeframe(timeframe)) return "60d";
  if (isYahooHourlyTimeframe(timeframe)) return "1y";
  return "3y";
}

export function coerceLookbackForTimeframe(
  timeframe: BacktestTimeframe,
  current: BacktestLookbackOptionId,
): BacktestLookbackOptionId {
  if (isYahooHourlyTimeframe(timeframe)) {
    if (current === "2y" || current === "3y" || current === "5y" || current === "10y" || current === "all") {
      return "1.5y";
    }
  }

  const options = getLookbackOptionsForTimeframe(timeframe);
  if (options.some((option) => option.id === current)) return current;
  return defaultLookbackForTimeframe(timeframe);
}

export function lookbackOptionCalendarDays(optionId: BacktestLookbackOptionId): number {
  for (const group of [MINUTE_LOOKBACK_OPTIONS, HOURLY_LOOKBACK_OPTIONS, DAILY_LOOKBACK_OPTIONS]) {
    const match = group.find((option) => option.id === optionId);
    if (match) return match.calendarDays;
  }
  return 365;
}

export function formatLookbackOptionLabel(optionId: BacktestLookbackOptionId): string {
  for (const group of [MINUTE_LOOKBACK_OPTIONS, HOURLY_LOOKBACK_OPTIONS, DAILY_LOOKBACK_OPTIONS]) {
    const match = group.find((option) => option.id === optionId);
    if (match) return match.label;
  }
  return optionId.toUpperCase();
}

export function clampLookbackCalendarDays(
  calendarDays: number,
  timeframe: BacktestTimeframe,
): number {
  if (isHighDensityTimeframe(timeframe) || isParquetCachedTimeframe(timeframe)) {
    return Math.min(calendarDays, INTRADAY_MAX_CALENDAR_DAYS);
  }
  if (isYahooHourlyTimeframe(timeframe)) {
    return Math.min(calendarDays, YAHOO_HOURLY_MAX_CALENDAR_DAYS);
  }
  if (timeframe === "1D") return Math.min(calendarDays, 365 * 10);
  if (timeframe === "1W") return Math.min(calendarDays, 365 * 15);
  if (timeframe === "1M") return Math.min(calendarDays, 365 * 20);
  return calendarDays;
}

export function mapLookbackOptionToEngineLookback(
  option: BacktestLookbackOptionId,
): BacktestLookbackId {
  if (option === "3y") return "3y";
  if (option === "5y" || option === "10y" || option === "all") return "5y";
  if (option === "2y" || option === "1.5y") return "3y";
  return "1y";
}

/** @deprecated Use getLookbackOptionsForTimeframe instead. */
export type IntradayLookbackId = "30d" | "60d" | "90d";

/** @deprecated Use getLookbackOptionsForTimeframe instead. */
export function getIntradayLookbackOptions(
  timeframe: BacktestTimeframe,
): readonly BacktestLookbackOption[] {
  return getLookbackOptionsForTimeframe(timeframe);
}

/** @deprecated Use defaultLookbackForTimeframe instead. */
export function defaultIntradayLookback(timeframe: BacktestTimeframe): BacktestLookbackOptionId {
  return defaultLookbackForTimeframe(timeframe);
}

/** @deprecated Use lookbackOptionCalendarDays instead. */
export function intradayLookbackCalendarDays(
  timeframe: BacktestTimeframe,
  intradayLookback: IntradayLookbackId,
): number {
  void timeframe;
  if (intradayLookback === "30d") return 30;
  if (intradayLookback === "60d") return 60;
  return 90;
}

export function evaluationBarsFromCalendarDays(
  calendarDays: number,
  timeframe: BacktestTimeframe,
): number {
  const tradingDays = Math.max(1, Math.round(calendarDays * (252 / 365)));
  return Math.ceil(tradingDays * barsPerTradingSession(timeframe));
}

export function resolveBacktestFetchRange(input: {
  lookbackOption: BacktestLookbackOptionId;
  timeframe: BacktestTimeframe;
}): {
  from: string;
  to: string;
  calendarDays: number;
  engineLookback: BacktestLookbackId;
  performanceWarning: string | null;
} {
  const to = new Date().toISOString().slice(0, 10);
  const calendarDays = clampLookbackCalendarDays(
    lookbackOptionCalendarDays(input.lookbackOption),
    input.timeframe,
  );
  const from = new Date(Date.now() - calendarDays * 86_400_000).toISOString().slice(0, 10);

  let performanceWarning: string | null = null;
  if (input.timeframe === "1m" && (input.lookbackOption === "1y" || input.lookbackOption === "2y")) {
    performanceWarning =
      "1Y+ lookback with 1m timeframe automatically downsampled for chart performance.";
  }

  return {
    from,
    to,
    calendarDays,
    engineLookback: mapLookbackOptionToEngineLookback(input.lookbackOption),
    performanceWarning,
  };
}

/** Approximate bars per US cash session for window sizing. */
export function barsPerTradingSession(timeframe: BacktestTimeframe): number {
  switch (timeframe) {
    case "1m":
      return 390;
    case "5m":
      return 78;
    case "15m":
      return 26;
    case "30m":
      return 13;
    case "1H":
      return 7;
    case "4H":
      return 2;
    case "1D":
      return 1;
    case "1W":
      return 1 / 5;
    case "1M":
      return 1 / 21;
    default:
      return 1;
  }
}

/** Annualization factor for Sharpe on the active bar resolution. */
export function barsPerYear(timeframe: BacktestTimeframe): number {
  const sessions = 252;
  return Math.max(1, sessions * barsPerTradingSession(timeframe));
}

export function backtestWarmupBars(timeframe: BacktestTimeframe): number {
  return Math.ceil(50 * barsPerTradingSession(timeframe));
}

export function backtestEvaluationBars(
  lookback: BacktestLookbackId,
  timeframe: BacktestTimeframe,
): number {
  const tradingDays = lookback === "1y" ? 252 : lookback === "3y" ? 756 : 1260;
  return Math.ceil(tradingDays * barsPerTradingSession(timeframe));
}

export function backtestHistoryCalendarDays(
  lookback: BacktestLookbackId,
  timeframe: BacktestTimeframe,
): number {
  const lookbackCalendar =
    lookback === "1y" ? 365 : lookback === "3y" ? 365 * 3 : 365 * 5;
  return clampLookbackCalendarDays(lookbackCalendar, timeframe);
}

export function backtestDateRange(
  lookback: BacktestLookbackId,
  timeframe: BacktestTimeframe,
): { from: string; to: string } {
  const calendarDays = backtestHistoryCalendarDays(lookback, timeframe);
  const to = new Date();
  const from = new Date(Date.now() - calendarDays * 86_400_000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function clampYahooHourlyFromDate(from: string, to: string): string {
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const minFromMs = toDate.getTime() - YAHOO_HOURLY_MAX_CALENDAR_DAYS * 86_400_000;
  const requestedFromMs = new Date(`${from}T00:00:00.000Z`).getTime();
  const clampedMs = Math.max(requestedFromMs, minFromMs);
  return new Date(clampedMs).toISOString().slice(0, 10);
}

/** Stable bar key used for signal lookup and chart dataKey. */
export function barKeyFromUnix(unixSeconds: number, timeframe: BacktestTimeframe): string {
  const date = new Date(unixSeconds * 1000);
  if (isIntradayBacktestTimeframe(timeframe)) {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`;
  }
  return date.toISOString().slice(0, 10);
}

export function formatBacktestAxisLabel(barKey: string, timeframe: BacktestTimeframe): string {
  if (isIntradayBacktestTimeframe(timeframe)) {
    const match = barKey.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      return `${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
    }
  }
  return barKey.slice(0, 10);
}

export function formatBacktestTooltipLabel(barKey: string, timeframe: BacktestTimeframe): string {
  if (isIntradayBacktestTimeframe(timeframe)) {
    return formatBacktestAxisLabel(barKey, timeframe);
  }
  return barKey.slice(0, 10);
}
