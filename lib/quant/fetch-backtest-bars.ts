import "server-only";

import {
  clampYahooHourlyFromDate,
  formatLookbackOptionLabel,
  getBacktestDataProvider,
  isHighDensityTimeframe,
  isParquetCachedTimeframe,
  isYahooHourlyTimeframe,
  type BacktestLookbackOptionId,
  type BacktestTimeframe,
} from "@/lib/quant/backtest-timeframe";
import { yahooBacktestFetchCandidates } from "@/lib/quant/asset-ticker-map";
import { fetchParquetBacktestBars } from "@/lib/quant/historical-cache";
import type { BacktestHistoryBar, BacktestHistoryPayload } from "@/lib/types";
import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1h" | "1d" | "1wk" | "1mo";

export function buildMarketDataUnavailableMessage(input: {
  symbol: string;
  lookbackOption: BacktestLookbackOptionId;
}): string {
  const period = formatLookbackOptionLabel(input.lookbackOption);
  return (
    `Market Data Unavailable: Unable to retrieve candle history for ${input.symbol} over ${period}. ` +
    `Please try selecting a different timeframe or lookback period.`
  );
}

function yahooInterval(timeframe: BacktestTimeframe): YahooInterval {
  switch (timeframe) {
    case "1m":
      return "1m";
    case "5m":
      return "5m";
    case "15m":
      return "15m";
    case "30m":
      return "30m";
    case "1H":
      return "1h";
    case "4H":
      return "1h";
    case "1D":
      return "1d";
    case "1W":
      return "1wk";
    case "1M":
      return "1mo";
    default:
      return "1d";
  }
}

function toUnixSeconds(value: unknown): number | null {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return value > 1e11 ? Math.floor(value / 1000) : value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }
  return null;
}

function bucketBars(bars: BacktestHistoryBar[], bucketMinutes: number): BacktestHistoryBar[] {
  if (bars.length === 0) return bars;
  const bucketSeconds = bucketMinutes * 60;
  const output: BacktestHistoryBar[] = [];
  let current: BacktestHistoryBar | null = null;
  let bucketStart = 0;

  for (const bar of bars) {
    const start = Math.floor(bar.time / bucketSeconds) * bucketSeconds;
    if (!current || start !== bucketStart) {
      if (current) output.push(current);
      bucketStart = start;
      current = { ...bar, time: start };
      continue;
    }
    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
    current.volume = (current.volume ?? 0) + (bar.volume ?? 0);
  }
  if (current) output.push(current);
  return output;
}

function parseYahooQuoteRows(rows: Array<Record<string, unknown>>): BacktestHistoryBar[] {
  const bars: BacktestHistoryBar[] = [];
  for (const row of rows) {
    const time = toUnixSeconds(row.date);
    const close = typeof row.close === "number" ? row.close : null;
    if (time == null || close == null || !Number.isFinite(close) || close <= 0) continue;
    const open = typeof row.open === "number" ? row.open : close;
    const high = typeof row.high === "number" ? row.high : Math.max(open, close);
    const low = typeof row.low === "number" ? row.low : Math.min(open, close);
    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume: typeof row.volume === "number" ? row.volume : null,
    });
  }
  bars.sort((left, right) => left.time - right.time);
  return bars;
}

function parseYahooDirectChartPayload(payload: unknown): BacktestHistoryBar[] {
  const chart = (payload as { chart?: { result?: Array<Record<string, unknown>> } })?.chart;
  const result = chart?.result?.[0];
  if (!result) return [];

  const timestamps = (result.timestamp as number[] | undefined) ?? [];
  const quote = (result.indicators as { quote?: Array<Record<string, unknown[]>> } | undefined)
    ?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

  const bars: BacktestHistoryBar[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const time = timestamps[index];
    const close = closes[index];
    if (typeof time !== "number" || typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    const open = typeof opens[index] === "number" ? (opens[index] as number) : close;
    const high = typeof highs[index] === "number" ? (highs[index] as number) : Math.max(open, close);
    const low = typeof lows[index] === "number" ? (lows[index] as number) : Math.min(open, close);
    const volume = typeof volumes[index] === "number" ? (volumes[index] as number) : null;
    bars.push({ time, open, high, low, close, volume });
  }

  bars.sort((left, right) => left.time - right.time);
  return bars;
}

async function fetchYahooChartDirect(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
}): Promise<BacktestHistoryBar[]> {
  const interval = yahooInterval(input.timeframe);
  const period1 = Math.floor(Date.parse(`${input.from}T00:00:00.000Z`) / 1000);
  const period2 = Math.floor(Date.parse(`${input.to}T23:59:59.999Z`) / 1000);
  if (!Number.isFinite(period1) || !Number.isFinite(period2) || period2 <= period1) {
    return [];
  }

  const url =
    `${YAHOO_CHART_BASE}/${encodeURIComponent(input.symbol)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; BursaTerminal/1.0)",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 429) return [];
    throw new Error(`Yahoo direct chart HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  return parseYahooDirectChartPayload(payload);
}

async function fetchYahooLibraryChart(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
}): Promise<BacktestHistoryBar[]> {
  const from = isYahooHourlyTimeframe(input.timeframe)
    ? clampYahooHourlyFromDate(input.from, input.to)
    : input.from;
  const period1 = new Date(`${from}T00:00:00.000Z`);
  const period2 = new Date(`${input.to}T23:59:59.999Z`);
  const interval = yahooInterval(input.timeframe);

  const result: unknown = await yahoo.chart(
    input.symbol,
    { period1, period2, interval },
    { validateResult: false },
  );

  const payload = (result ?? {}) as { quotes?: Array<Record<string, unknown>> };
  return parseYahooQuoteRows(payload.quotes ?? []);
}

async function fetchYahooBacktestBars(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
}): Promise<{ bars: BacktestHistoryBar[]; from: string; truncated: boolean; resolvedSymbol: string | null }> {
  const from = isYahooHourlyTimeframe(input.timeframe)
    ? clampYahooHourlyFromDate(input.from, input.to)
    : input.from;
  const truncated = from !== input.from;
  const intraday = isHighDensityTimeframe(input.timeframe) || isYahooHourlyTimeframe(input.timeframe);
  const candidates = yahooBacktestFetchCandidates(input.symbol, intraday);

  for (const candidate of candidates) {
    try {
      let bars = await fetchYahooLibraryChart({
        symbol: candidate,
        timeframe: input.timeframe,
        from,
        to: input.to,
      });

      if (bars.length === 0) {
        bars = await fetchYahooChartDirect({
          symbol: candidate,
          timeframe: input.timeframe,
          from,
          to: input.to,
        });
      }

      if (bars.length > 0) {
        if (input.timeframe === "4H") {
          return {
            bars: bucketBars(bars, 240),
            from,
            truncated: truncated || bars.length === 0,
            resolvedSymbol: candidate,
          };
        }
        return { bars, from, truncated, resolvedSymbol: candidate };
      }
    } catch {
      // Try next Yahoo symbol candidate.
    }
  }

  return { bars: [], from, truncated, resolvedSymbol: null };
}

function basePayload(
  input: { symbol: string; timeframe: BacktestTimeframe; from: string; to: string },
  source: BacktestHistoryPayload["source"],
): Omit<BacktestHistoryPayload, "bars" | "truncated" | "warning"> {
  return {
    source,
    symbol: input.symbol,
    timeframe: input.timeframe,
    from: input.from,
    to: input.to,
    asOf: new Date().toISOString(),
    assetBuyAndHold: [],
    assetHoldReturn: null,
  };
}

async function fetchParquetBacktestHistory(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
  lookbackOption?: BacktestLookbackOptionId;
}): Promise<BacktestHistoryPayload> {
  if (!isParquetCachedTimeframe(input.timeframe)) {
    throw new Error(`Timeframe ${input.timeframe} is not served by the parquet cache.`);
  }

  const parquet = await fetchParquetBacktestBars({
    symbol: input.symbol,
    timeframe: input.timeframe,
    from: input.from,
    to: input.to,
  });

  const warning =
    parquet.bars.length === 0
      ? input.lookbackOption != null
        ? buildMarketDataUnavailableMessage({
            symbol: input.symbol,
            lookbackOption: input.lookbackOption,
          })
        : parquet.warning
      : parquet.warning;

  return {
    ...basePayload(input, "parquet"),
    bars: parquet.bars,
    truncated: false,
    warning,
  };
}

async function fetchYahooBacktestHistory(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
  lookbackOption?: BacktestLookbackOptionId;
}): Promise<BacktestHistoryPayload> {
  try {
    const yahooResult = await fetchYahooBacktestBars(input);
    const warning =
      yahooResult.truncated && isYahooHourlyTimeframe(input.timeframe)
        ? "Yahoo Finance hourly history capped at 2 years — start date adjusted."
        : yahooResult.truncated
          ? "Selected timeframe history truncated by provider API."
          : yahooResult.bars.length === 0 && input.lookbackOption
            ? buildMarketDataUnavailableMessage({
                symbol: input.symbol,
                lookbackOption: input.lookbackOption,
              })
            : yahooResult.bars.length === 0
              ? buildMarketDataUnavailableMessage({
                  symbol: input.symbol,
                  lookbackOption: input.lookbackOption ?? "60d",
                })
              : yahooResult.resolvedSymbol && yahooResult.resolvedSymbol !== input.symbol
                ? `Resolved ${input.symbol} → ${yahooResult.resolvedSymbol} via Yahoo Finance.`
                : null;

    return {
      ...basePayload({ ...input, from: yahooResult.from }, "yahoo"),
      bars: yahooResult.bars,
      truncated: yahooResult.truncated,
      warning,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return {
      ...basePayload(input, "yahoo"),
      bars: [],
      truncated: false,
      warning:
        input.lookbackOption != null
          ? buildMarketDataUnavailableMessage({
              symbol: input.symbol,
              lookbackOption: input.lookbackOption,
            })
          : `Yahoo Finance history fetch failed: ${detail}`,
    };
  }
}

export async function fetchBacktestHistory(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
  lookbackOption?: BacktestLookbackOptionId;
}): Promise<BacktestHistoryPayload> {
  const provider = getBacktestDataProvider(input.timeframe);

  if (provider === "parquet") {
    return fetchParquetBacktestHistory(input);
  }

  return fetchYahooBacktestHistory(input);
}
