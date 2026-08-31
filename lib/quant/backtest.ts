/** Client-safe historical backtesting utilities. */

import { generateCustomStrategySignals, resolveCustomRiskPct } from "./custom-strategy-engine";
import { isSpotAccumulationStrategy, type CustomStrategy } from "./custom-strategy";
import { isQuantCommoditySymbol } from "./asset-ticker-map";
import {
  backtestEvaluationBars,
  backtestWarmupBars,
  barKeyFromUnix,
  barsPerTradingSession,
  barsPerYear,
  evaluationBarsFromCalendarDays,
  isHighDensityTimeframe,
  type BacktestTimeframe,
} from "./backtest-timeframe";
import { normalizeTradingDate, unixToDate } from "@/lib/quant/math";
import type { BacktestHistoryBar, DailyClose } from "@/lib/types";

export const BACKTEST_STRATEGIES = [
  { id: "rsi_mean_reversion_14", label: "RSI Mean-Reversion (14D / 30-70)" },
  { id: "bollinger_breakout_20", label: "Bollinger Band Breakout (20, 2.0)" },
  { id: "ema_crossover_5_20", label: "Fast EMA Crossover (5 / 20)" },
  { id: "stochastic_14_3", label: "Stochastic Oscillator (%K 14, %D 3)" },
  { id: "macd_histogram_flip", label: "MACD Histogram Zero-Flip (12, 26, 9)" },
  { id: "keltner_reversal", label: "Keltner Channel Reversal (20 EMA, 2x ATR)" },
  { id: "parabolic_sar_flip", label: "Parabolic SAR Trailing Flip (0.02, 0.2)" },
] as const;

export const BACKTEST_LOOKBACKS = [
  { id: "1y", label: "1Y", days: 365 },
  { id: "3y", label: "3Y", days: 365 * 3 },
  { id: "5y", label: "5Y", days: 365 * 5 },
] as const;

export const BACKTEST_WARMUP_DAYS = 50;
export const TRADING_FEE_RATE = 0.001;
export const SP500_BENCHMARK_SYMBOL = "^GSPC";

/** Calendar days to request from the history API (lookback + warm-up buffer). */
export const BACKTEST_FETCH_DAYS: Record<BacktestLookbackId, number> = {
  "1y": 300,
  "3y": 850,
  "5y": 1350,
};

/** Trading sessions shown in equity curve and return metrics. */
export const BACKTEST_TRADING_DAYS: Record<BacktestLookbackId, number> = {
  "1y": 252,
  "3y": 756,
  "5y": 1260,
};

export type BacktestStrategyId = (typeof BACKTEST_STRATEGIES)[number]["id"];
export type BacktestLookbackId = (typeof BACKTEST_LOOKBACKS)[number]["id"];

export type BacktestSignalAction =
  | "open_long"
  | "close_long"
  | "open_short"
  | "close_short";

export type BacktestSignal = {
  date: string;
  type: "buy" | "sell";
  price: number;
  /** Explicit trade intent — inferred from type + position when omitted. */
  action?: BacktestSignalAction;
};

export type BacktestTradeDirection = "LONG" | "SHORT";

export type BacktestTradeRecord = {
  id: number;
  direction: BacktestTradeDirection;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  pnlDollar: number;
  pnlPct: number;
  holdBars: number;
  entryEquity: number;
};

export type BacktestEquityPoint = {
  date: string;
  strategy: number;
  benchmark: number;
  buyHold: number;
  sp500Equity: number;
  cash: number;
};

export type BacktestMetrics = {
  totalReturnPct: number;
  benchmarkReturnPct: number;
  buyHoldReturnPct: number;
  sp500ReturnPct: number;
  winRatePct: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  executionMode?: "STANDARD" | "SPOT_ACCUMULATION";
  buysExecutedCount?: number;
  averageCostBasis?: number;
  unrealizedPnlPct?: number;
  totalUnitsHeld?: number;
};

export type BacktestResult = {
  equityCurve: BacktestEquityPoint[];
  signals: BacktestSignal[];
  trades: BacktestTradeRecord[];
  metrics: BacktestMetrics;
  usedMockData: boolean;
};

export type AlignedSeries = {
  dates: string[];
  closes: number[];
  highs: number[];
  lows: number[];
  benchmarkCloses: number[];
  sp500Closes: number[];
  timeframe: BacktestTimeframe;
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sortDailyCloses(points: DailyClose[]): DailyClose[] {
  return [...points]
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .sort((left, right) => left.time - right.time);
}

function closesToMap(points: DailyClose[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) {
    map.set(normalizeTradingDate(unixToDate(point.time)), point.close);
  }
  return map;
}

function generateTradingDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(normalizeTradingDate(unixToDate(Math.floor(cursor.getTime() / 1000))));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

function generateMockCloses(
  count: number,
  startPrice: number,
  muDaily: number,
  sigmaDaily: number,
  seed: number,
): DailyClose[] {
  const rand = seededRandom(seed);
  const dates = generateTradingDates(count);
  const closes: DailyClose[] = [];
  let price = startPrice;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    const parsed = Date.parse(`${date}T12:00:00+08:00`);
    closes.push({
      time: Math.floor(parsed / 1000),
      close: Number(price.toFixed(4)),
    });

    if (index === dates.length - 1) break;

    const z =
      Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
    const next = price * Math.exp((muDaily - 0.5 * sigmaDaily * sigmaDaily) + sigmaDaily * z);
    price = Math.max(0.01, next);
  }

  return closes;
}

function deriveBenchmarkFromStock(stock: DailyClose[], seed: number): DailyClose[] {
  const sorted = sortDailyCloses(stock);
  if (sorted.length < 2) return sorted;

  const rand = seededRandom(seed + 17);
  const benchStart = 1520;
  const output: DailyClose[] = [{ ...sorted[0]!, close: benchStart }];

  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]!.close;
    const curr = sorted[index]!.close;
    const stockReturn = prev > 0 ? (curr - prev) / prev : 0;
    const noise = (rand() - 0.5) * 0.004;
    const benchReturn = stockReturn * 0.65 + noise;
    const prevBench = output[index - 1]!.close;
    output.push({
      time: sorted[index]!.time,
      close: Number(Math.max(1, prevBench * (1 + benchReturn)).toFixed(4)),
    });
  }

  return output;
}

export function alignPriceSeries(
  stock: DailyClose[],
  benchmark: DailyClose[],
): AlignedSeries | null {
  return alignWithForwardFill(stock, benchmark);
}

function forwardFillOnDates(dates: string[], series: DailyClose[], fallback: number): number[] {
  const map = closesToMap(series);
  let last = sortDailyCloses(series).find((point) => Number.isFinite(point.close))?.close ?? fallback;
  return dates.map((date) => {
    if (map.has(date)) last = map.get(date)!;
    return last;
  });
}

function attachSp500Series(aligned: AlignedSeries, sp500: DailyClose[], seed: number): AlignedSeries {
  const sorted = sortDailyCloses(sp500);
  const fallback = sorted.at(-1)?.close ?? 5200;
  if (sorted.length >= 20) {
    const dayKeys = aligned.dates.map((date) =>
      date.includes("T") ? date.slice(0, 10) : date,
    );
    return {
      ...aligned,
      sp500Closes: forwardFillOnDates(dayKeys, sorted, fallback),
    };
  }

  const mock = generateMockCloses(aligned.dates.length, fallback, 0.00035, 0.012, seed + 211);
  const dayKeys = aligned.dates.map((date) => (date.includes("T") ? date.slice(0, 10) : date));
  return {
    ...aligned,
    sp500Closes: forwardFillOnDates(dayKeys, mock, fallback),
  };
}

function alignWithForwardFill(stock: DailyClose[], benchmark: DailyClose[]): AlignedSeries | null {
  const stockSorted = sortDailyCloses(stock);
  if (stockSorted.length === 0) return null;

  const benchSorted = sortDailyCloses(benchmark);
  const benchMap = closesToMap(benchSorted);
  let lastBench =
    benchSorted.find((point) => Number.isFinite(point.close))?.close ?? stockSorted[0]!.close;

  const dates: string[] = [];
  const closes: number[] = [];
  const benchmarkCloses: number[] = [];

  for (const point of stockSorted) {
    const date = normalizeTradingDate(unixToDate(point.time));
    if (benchMap.has(date)) lastBench = benchMap.get(date)!;
    dates.push(date);
    closes.push(point.close);
    benchmarkCloses.push(lastBench);
  }

  if (dates.length < 20) return null;

  return {
    dates,
    closes,
    highs: closes,
    lows: closes,
    benchmarkCloses,
    sp500Closes: forwardFillOnDates(dates, [], lastBench),
    timeframe: "1D",
  };
}

export function prepareBacktestData(input: {
  symbol: string;
  stockPoints: DailyClose[];
  benchmarkPoints: DailyClose[];
  sp500Points: DailyClose[];
  lookback: BacktestLookbackId;
}): { aligned: AlignedSeries | null; usedMockData: boolean } {
  const fetchTarget = BACKTEST_FETCH_DAYS[input.lookback];
  const seed = hashSeed(`${input.symbol}:${input.lookback}`);
  const stockStart =
    sortDailyCloses(input.stockPoints).at(-1)?.close ??
    sortDailyCloses(input.stockPoints).at(0)?.close ??
    10;

  const commodity = isQuantCommoditySymbol(input.symbol);
  const minStockBars = commodity ? 20 : 30;
  const minAlignedBars = commodity ? 20 : 30;

  let usedMockData = false;
  let stock = sortDailyCloses(input.stockPoints);
  let benchmark = sortDailyCloses(input.benchmarkPoints);
  let sp500 = sortDailyCloses(input.sp500Points);

  if (stock.length < minStockBars) {
    if (commodity) {
      if (stock.length === 0) {
        return { aligned: null, usedMockData: false };
      }
    } else {
      stock = generateMockCloses(fetchTarget, stockStart, 0.00025, 0.018, seed);
      benchmark = generateMockCloses(fetchTarget, 1520, 0.00012, 0.011, seed + 99);
      sp500 = generateMockCloses(fetchTarget, 5200, 0.00035, 0.012, seed + 199);
      usedMockData = true;
    }
  } else if (benchmark.length < 20) {
    benchmark = deriveBenchmarkFromStock(stock, seed);
  }

  let aligned = alignWithForwardFill(stock, benchmark);
  if (!aligned || aligned.dates.length < minAlignedBars) {
    if (commodity) {
      return { aligned, usedMockData: false };
    }

    stock = generateMockCloses(fetchTarget, stockStart, 0.00025, 0.018, seed + 1);
    benchmark = generateMockCloses(fetchTarget, 1520, 0.00012, 0.011, seed + 100);
    sp500 = generateMockCloses(fetchTarget, 5200, 0.00035, 0.012, seed + 200);
    aligned = alignWithForwardFill(stock, benchmark)!;
    usedMockData = true;
  }

  aligned = attachSp500Series(aligned, sp500, seed);

  const maxBars = BACKTEST_TRADING_DAYS[input.lookback] + BACKTEST_WARMUP_DAYS;
  if (aligned.dates.length > maxBars) {
    const start = aligned.dates.length - maxBars;
    aligned = {
      dates: aligned.dates.slice(start),
      closes: aligned.closes.slice(start),
      highs: aligned.highs.slice(start),
      lows: aligned.lows.slice(start),
      benchmarkCloses: aligned.benchmarkCloses.slice(start),
      sp500Closes: aligned.sp500Closes.slice(start),
      timeframe: aligned.timeframe,
    };
  }

  return { aligned, usedMockData };
}

function sortBacktestBars(bars: BacktestHistoryBar[]): BacktestHistoryBar[] {
  return [...bars]
    .filter(
      (bar) =>
        Number.isFinite(bar.close) &&
        bar.close > 0 &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low),
    )
    .sort((left, right) => left.time - right.time);
}

function alignBarSeriesWithDailyBenchmarks(
  bars: BacktestHistoryBar[],
  benchmark: DailyClose[],
  sp500: DailyClose[],
  timeframe: BacktestTimeframe,
): AlignedSeries | null {
  const sorted = sortBacktestBars(bars);
  if (sorted.length === 0) return null;

  const benchSorted = sortDailyCloses(benchmark);
  const benchMap = closesToMap(benchSorted);
  let lastBench =
    benchSorted.find((point) => Number.isFinite(point.close))?.close ?? sorted[0]!.close;

  const dates: string[] = [];
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const benchmarkCloses: number[] = [];

  for (const bar of sorted) {
    const dayKey = normalizeTradingDate(unixToDate(bar.time));
    if (benchMap.has(dayKey)) lastBench = benchMap.get(dayKey)!;
    dates.push(barKeyFromUnix(bar.time, timeframe));
    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    benchmarkCloses.push(lastBench);
  }

  if (dates.length < 20) return null;

  return {
    dates,
    closes,
    highs,
    lows,
    benchmarkCloses,
    sp500Closes: forwardFillOnDates(
      dates.map((date) => (date.includes("T") ? date.slice(0, 10) : date)),
      sp500,
      sp500.at(-1)?.close ?? lastBench,
    ),
    timeframe,
  };
}

export function prepareBacktestBarData(input: {
  symbol: string;
  bars: BacktestHistoryBar[];
  benchmarkPoints: DailyClose[];
  sp500Points: DailyClose[];
  lookback: BacktestLookbackId;
  timeframe: BacktestTimeframe;
  calendarDaysCap?: number;
  evaluationCalendarDays?: number;
}): { aligned: AlignedSeries | null; usedMockData: boolean } {
  const seed = hashSeed(`${input.symbol}:${input.lookback}:${input.timeframe}`);
  const sortedBars = sortBacktestBars(input.bars);
  const commodity = isQuantCommoditySymbol(input.symbol);
  const minBars = commodity ? 20 : 30;

  if (sortedBars.length < minBars) {
    if (commodity && sortedBars.length === 0) {
      return { aligned: null, usedMockData: false };
    }
    return prepareBacktestData({
      symbol: input.symbol,
      stockPoints: sortedBars.map((bar) => ({ time: bar.time, close: bar.close })),
      benchmarkPoints: input.benchmarkPoints,
      sp500Points: input.sp500Points,
      lookback: input.lookback,
    });
  }

  let aligned = alignBarSeriesWithDailyBenchmarks(
    sortedBars,
    input.benchmarkPoints,
    input.sp500Points,
    input.timeframe,
  );

  if (!aligned || aligned.dates.length < minBars) {
    if (commodity) return { aligned, usedMockData: false };
    return prepareBacktestData({
      symbol: input.symbol,
      stockPoints: sortedBars.map((bar) => ({ time: bar.time, close: bar.close })),
      benchmarkPoints: input.benchmarkPoints,
      sp500Points: input.sp500Points,
      lookback: input.lookback,
    });
  }

  aligned = attachSp500Series(aligned, sortDailyCloses(input.sp500Points), seed);

  const evaluationDays =
    input.evaluationCalendarDays ?? input.calendarDaysCap ?? null;
  const evaluationBars =
    evaluationDays != null
      ? evaluationBarsFromCalendarDays(evaluationDays, input.timeframe)
      : backtestEvaluationBars(input.lookback, input.timeframe);
  const maxBars = evaluationBars + backtestWarmupBars(input.timeframe);
  if (aligned.dates.length > maxBars) {
    const start = aligned.dates.length - maxBars;
    aligned = {
      dates: aligned.dates.slice(start),
      closes: aligned.closes.slice(start),
      highs: aligned.highs.slice(start),
      lows: aligned.lows.slice(start),
      benchmarkCloses: aligned.benchmarkCloses.slice(start),
      sp500Closes: aligned.sp500Closes.slice(start),
      timeframe: aligned.timeframe,
    };
  }

  return { aligned, usedMockData: false };
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function rsi(values: number[], period = 14): (number | null)[] {
  const output: (number | null)[] = Array(values.length).fill(null);
  if (values.length <= period) return output;

  let avgGain = 0;
  let avgLoss = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    if (delta >= 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;

  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return output;
}

function bollinger(values: number[], period = 20, mult = 2) {
  const middle = sma(values, period);
  const upper: (number | null)[] = Array(values.length).fill(null);
  const lower: (number | null)[] = Array(values.length).fill(null);

  for (let index = period - 1; index < values.length; index += 1) {
    const slice = values.slice(index - period + 1, index + 1);
    const mean = middle[index]!;
    const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper[index] = mean + mult * std;
    lower[index] = mean - mult * std;
  }

  return { middle, upper, lower };
}

function ema(values: number[], period: number): number[] {
  const output = Array(values.length).fill(Number.NaN);
  if (values.length < period) return output;

  let prev = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  output[period - 1] = prev;
  const multiplier = 2 / (period + 1);

  for (let index = period; index < values.length; index += 1) {
    prev = (values[index]! - prev) * multiplier + prev;
    output[index] = prev;
  }

  return output;
}

function estimateOhlc(closes: number[]): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let index = 0; index < closes.length; index += 1) {
    const close = closes[index]!;
    const prev = closes[index - 1] ?? close;
    highs.push(Math.max(close, prev) * 1.0015);
    lows.push(Math.min(close, prev) * 0.9985);
  }

  return { highs, lows };
}

function atr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const output = Array(closes.length).fill(Number.NaN);
  if (closes.length <= period) return output;

  const trueRanges: number[] = [];
  for (let index = 0; index < closes.length; index += 1) {
    const prevClose = closes[index - 1] ?? closes[index]!;
    const range = Math.max(
      highs[index]! - lows[index]!,
      Math.abs(highs[index]! - prevClose),
      Math.abs(lows[index]! - prevClose),
    );
    trueRanges.push(range);
  }

  let prevAtr =
    trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  output[period - 1] = prevAtr;

  for (let index = period; index < closes.length; index += 1) {
    prevAtr = (prevAtr * (period - 1) + trueRanges[index]!) / period;
    output[index] = prevAtr;
  }

  return output;
}

function stochastic(
  closes: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): { k: number[]; d: number[] } {
  const rawK = Array(closes.length).fill(Number.NaN);

  for (let index = period - 1; index < closes.length; index += 1) {
    const window = closes.slice(index - period + 1, index + 1);
    const highest = Math.max(...window);
    const lowest = Math.min(...window);
    rawK[index] =
      highest === lowest ? 50 : (100 * (closes[index]! - lowest)) / (highest - lowest);
  }

  const k = ema(rawK.map((value) => (Number.isNaN(value) ? 0 : value)), smoothK);
  const d = ema(k.map((value) => (Number.isNaN(value) ? 0 : value)), smoothD);

  return { k, d };
}

function macdHistogram(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): number[] {
  const fast = ema(closes, fastPeriod);
  const slow = ema(closes, slowPeriod);
  const macdLine = closes.map((_, index) => {
    const fastValue = fast[index];
    const slowValue = slow[index];
    if (Number.isNaN(fastValue) || Number.isNaN(slowValue)) return Number.NaN;
    return fastValue - slowValue;
  });

  const signal = ema(
    macdLine.map((value) => (Number.isNaN(value) ? 0 : value)),
    signalPeriod,
  );

  return macdLine.map((value, index) => {
    const signalValue = signal[index];
    if (Number.isNaN(value) || Number.isNaN(signalValue)) return Number.NaN;
    return value - signalValue;
  });
}

function keltnerChannels(closes: number[], period = 20, atrMult = 2) {
  const { highs, lows } = estimateOhlc(closes);
  const middle = ema(closes, period);
  const atrValues = atr(highs, lows, closes, period);
  const upper = middle.map((value, index) =>
    Number.isNaN(value) || Number.isNaN(atrValues[index]!)
      ? Number.NaN
      : value + atrMult * atrValues[index]!,
  );
  const lower = middle.map((value, index) =>
    Number.isNaN(value) || Number.isNaN(atrValues[index]!)
      ? Number.NaN
      : value - atrMult * atrValues[index]!,
  );

  return { middle, upper, lower };
}

function parabolicSarTrend(
  closes: number[],
  afStart = 0.02,
  afMax = 0.2,
): { sar: number[]; bullish: boolean[] } {
  const { highs, lows } = estimateOhlc(closes);
  const length = closes.length;
  const sar = Array(length).fill(Number.NaN);
  const bullish = Array(length).fill(false);

  if (length < 2) return { sar, bullish };

  let isBull = true;
  let ep = highs[0]!;
  let currentAf = afStart;
  sar[0] = lows[0]!;

  for (let index = 1; index < length; index += 1) {
    const prevSar = sar[index - 1]!;
    let nextSar = prevSar + currentAf * (ep - prevSar);

    if (isBull) {
      nextSar = Math.min(nextSar, lows[index - 1]!, lows[index - 2] ?? lows[index - 1]!);
      if (lows[index]! < nextSar) {
        isBull = false;
        nextSar = ep;
        ep = lows[index]!;
        currentAf = afStart;
      } else if (highs[index]! > ep) {
        ep = highs[index]!;
        currentAf = Math.min(afMax, currentAf + afStart);
      }
    } else {
      nextSar = Math.max(nextSar, highs[index - 1]!, highs[index - 2] ?? highs[index - 1]!);
      if (highs[index]! > nextSar) {
        isBull = true;
        nextSar = ep;
        ep = highs[index]!;
        currentAf = afStart;
      } else if (lows[index]! < ep) {
        ep = lows[index]!;
        currentAf = Math.min(afMax, currentAf + afStart);
      }
    }

    sar[index] = nextSar;
    bullish[index] = isBull;
  }

  return { sar, bullish };
}

function pushSignal(
  signals: BacktestSignal[],
  dates: string[],
  index: number,
  type: "buy" | "sell",
  closes: number[],
) {
  signals.push({ date: dates[index]!, type, price: closes[index]! });
}

function generateSignals(
  strategy: BacktestStrategyId,
  closes: number[],
  dates: string[],
): BacktestSignal[] {
  const signals: BacktestSignal[] = [];

  if (strategy === "rsi_mean_reversion_14") {
    const rsiValues = rsi(closes, 14);
    let inPosition = false;
    for (let index = 1; index < closes.length; index += 1) {
      const value = rsiValues[index];
      if (value == null) continue;
      if (!inPosition && value < 30) {
        pushSignal(signals, dates, index, "buy", closes);
        inPosition = true;
      } else if (inPosition && value > 70) {
        pushSignal(signals, dates, index, "sell", closes);
        inPosition = false;
      }
    }
    return signals;
  }

  if (strategy === "bollinger_breakout_20") {
    const bands = bollinger(closes, 20, 2);
    let inPosition = false;
    for (let index = 1; index < closes.length; index += 1) {
      const price = closes[index]!;
      const prevPrice = closes[index - 1]!;
      const upper = bands.upper[index];
      const middle = bands.middle[index];
      const prevUpper = bands.upper[index - 1];
      const prevMiddle = bands.middle[index - 1];
      if (upper == null || middle == null || prevUpper == null || prevMiddle == null) continue;
      if (!inPosition && prevPrice <= prevUpper && price > upper) {
        pushSignal(signals, dates, index, "buy", closes);
        inPosition = true;
      } else if (inPosition && prevPrice >= prevMiddle && price < middle) {
        pushSignal(signals, dates, index, "sell", closes);
        inPosition = false;
      }
    }
    return signals;
  }

  if (strategy === "ema_crossover_5_20") {
    const fast = ema(closes, 5);
    const slow = ema(closes, 20);
    for (let index = 1; index < closes.length; index += 1) {
      const prevFast = fast[index - 1];
      const prevSlow = slow[index - 1];
      const currFast = fast[index];
      const currSlow = slow[index];
      if (
        Number.isNaN(prevFast) ||
        Number.isNaN(prevSlow) ||
        Number.isNaN(currFast) ||
        Number.isNaN(currSlow)
      ) {
        continue;
      }
      if (prevFast <= prevSlow && currFast > currSlow) {
        pushSignal(signals, dates, index, "buy", closes);
      } else if (prevFast >= prevSlow && currFast < currSlow) {
        pushSignal(signals, dates, index, "sell", closes);
      }
    }
    return signals;
  }

  if (strategy === "stochastic_14_3") {
    const { k, d } = stochastic(closes, 14, 3, 3);
    let inPosition = false;
    for (let index = 1; index < closes.length; index += 1) {
      const prevK = k[index - 1];
      const prevD = d[index - 1];
      const currK = k[index];
      const currD = d[index];
      if (
        Number.isNaN(prevK) ||
        Number.isNaN(prevD) ||
        Number.isNaN(currK) ||
        Number.isNaN(currD)
      ) {
        continue;
      }
      if (!inPosition && currK < 20 && prevK <= prevD && currK > currD) {
        pushSignal(signals, dates, index, "buy", closes);
        inPosition = true;
      } else if (inPosition && currK > 80 && prevK >= prevD && currK < currD) {
        pushSignal(signals, dates, index, "sell", closes);
        inPosition = false;
      }
    }
    return signals;
  }

  if (strategy === "macd_histogram_flip") {
    const histogram = macdHistogram(closes, 12, 26, 9);
    for (let index = 1; index < closes.length; index += 1) {
      const prev = histogram[index - 1];
      const curr = histogram[index];
      if (Number.isNaN(prev) || Number.isNaN(curr)) continue;
      if (prev <= 0 && curr > 0) {
        pushSignal(signals, dates, index, "buy", closes);
      } else if (prev >= 0 && curr < 0) {
        pushSignal(signals, dates, index, "sell", closes);
      }
    }
    return signals;
  }

  if (strategy === "keltner_reversal") {
    const { highs, lows } = estimateOhlc(closes);
    const channel = keltnerChannels(closes, 20, 2);
    let inPosition = false;
    for (let index = 1; index < closes.length; index += 1) {
      const close = closes[index]!;
      const low = lows[index]!;
      const lower = channel.lower[index];
      const middle = channel.middle[index];
      const prevClose = closes[index - 1]!;
      const prevLower = channel.lower[index - 1];
      if (Number.isNaN(lower!) || Number.isNaN(middle!) || Number.isNaN(prevLower!)) continue;
      if (!inPosition && low < lower && prevClose < prevLower && close > lower) {
        pushSignal(signals, dates, index, "buy", closes);
        inPosition = true;
      } else if (inPosition && close >= middle) {
        pushSignal(signals, dates, index, "sell", closes);
        inPosition = false;
      }
    }
    return signals;
  }

  if (strategy === "parabolic_sar_flip") {
    const { bullish } = parabolicSarTrend(closes, 0.02, 0.2);
    for (let index = 1; index < closes.length; index += 1) {
      if (bullish[index - 1] === bullish[index]) continue;
      pushSignal(signals, dates, index, bullish[index] ? "buy" : "sell", closes);
    }
  }

  return signals;
}

function maxDrawdownPct(equity: number[]): number {
  let peak = equity[0] ?? 0;
  let maxDd = 0;
  for (const value of equity) {
    peak = Math.max(peak, value);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - value) / peak);
  }
  return maxDd * 100;
}

function sharpeRatio(periodReturns: number[], annualizationFactor = 252): number {
  if (periodReturns.length < 5) return 0;
  const mean = periodReturns.reduce((sum, value) => sum + value, 0) / periodReturns.length;
  const variance =
    periodReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, periodReturns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(annualizationFactor);
}

function resolveStopExitPrice(input: {
  direction: BacktestTradeDirection;
  entryPrice: number;
  stopLossPct: number;
  takeProfitPct: number;
  close: number;
  high: number;
  low: number;
}): { triggered: boolean; price: number; reason: "stop" | "take" } | null {
  const { direction, entryPrice, stopLossPct, takeProfitPct, close, high, low } = input;
  if (entryPrice <= 0) return null;

  if (direction === "LONG") {
    if (stopLossPct > 0) {
      const stopPrice = entryPrice * (1 - stopLossPct / 100);
      if (low <= stopPrice) {
        return { triggered: true, price: stopPrice, reason: "stop" };
      }
    }

    if (takeProfitPct > 0) {
      const takePrice = entryPrice * (1 + takeProfitPct / 100);
      if (high >= takePrice) {
        return { triggered: true, price: takePrice, reason: "take" };
      }
    }

    const movePct = ((close - entryPrice) / entryPrice) * 100;
    if (stopLossPct > 0 && movePct <= -stopLossPct) {
      return { triggered: true, price: close, reason: "stop" };
    }
    if (takeProfitPct > 0 && movePct >= takeProfitPct) {
      return { triggered: true, price: close, reason: "take" };
    }

    return null;
  }

  if (stopLossPct > 0) {
    const stopPrice = entryPrice * (1 + stopLossPct / 100);
    if (high >= stopPrice) {
      return { triggered: true, price: stopPrice, reason: "stop" };
    }
  }

  if (takeProfitPct > 0) {
    const takePrice = entryPrice * (1 - takeProfitPct / 100);
    if (low <= takePrice) {
      return { triggered: true, price: takePrice, reason: "take" };
    }
  }

  const movePct = ((entryPrice - close) / entryPrice) * 100;
  if (stopLossPct > 0 && movePct <= -stopLossPct) {
    return { triggered: true, price: close, reason: "stop" };
  }
  if (takeProfitPct > 0 && movePct >= takeProfitPct) {
    return { triggered: true, price: close, reason: "take" };
  }

  return null;
}

function normalizeWindowCurve(
  curve: BacktestEquityPoint[],
  windowStart: number,
  initialCapital: number,
): BacktestEquityPoint[] {
  const base = curve[windowStart];
  if (
    !base ||
    base.strategy <= 0 ||
    base.benchmark <= 0 ||
    base.buyHold <= 0 ||
    base.sp500Equity <= 0
  ) {
    return curve.slice(windowStart);
  }

  return curve.slice(windowStart).map((point) => ({
    ...point,
    strategy: initialCapital * (point.strategy / base.strategy),
    benchmark: initialCapital * (point.benchmark / base.benchmark),
    buyHold: initialCapital * (point.buyHold / base.buyHold),
    sp500Equity: initialCapital * (point.sp500Equity / base.sp500Equity),
  }));
}

function pushTradeRecord(
  trades: BacktestTradeRecord[],
  input: {
    direction: BacktestTradeDirection;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    pnlDollar: number;
    entryEquity: number;
    entryIndex: number;
    exitIndex: number;
  },
): void {
  const rawMovePct =
    input.entryPrice > 0
      ? ((input.exitPrice - input.entryPrice) / input.entryPrice) * 100
      : 0;
  const pnlPct =
    input.direction === "SHORT" ? -rawMovePct : rawMovePct;
  trades.push({
    id: trades.length + 1,
    direction: input.direction,
    entryDate: input.entryDate,
    entryPrice: input.entryPrice,
    exitDate: input.exitDate,
    exitPrice: input.exitPrice,
    pnlDollar: input.pnlDollar,
    pnlPct,
    holdBars: Math.max(0, input.exitIndex - input.entryIndex),
    entryEquity: input.entryEquity,
  });
}

function executeSell(input: {
  shares: number;
  price: number;
  entryEquity: number;
  tradePnls: number[];
}): { cash: number; shares: number; inPosition: false; pnlDollar: number } {
  const cash = input.shares * input.price * (1 - TRADING_FEE_RATE);
  const pnlDollar = cash - input.entryEquity;
  input.tradePnls.push(pnlDollar);
  return { cash, shares: 0, inPosition: false, pnlDollar };
}

function executeCloseShort(input: {
  shares: number;
  price: number;
  entryPrice: number;
  entryEquity: number;
  tradePnls: number[];
}): { cash: number; shares: number; inPosition: false; pnlDollar: number } {
  const openFee = input.shares * input.entryPrice * TRADING_FEE_RATE;
  const closeFee = input.shares * input.price * TRADING_FEE_RATE;
  const pnlDollar =
    input.shares * (input.entryPrice - input.price) - openFee - closeFee;
  const cash = input.entryEquity + pnlDollar;
  input.tradePnls.push(pnlDollar);
  return { cash, shares: 0, inPosition: false, pnlDollar };
}

function resolveSignalAction(
  signal: BacktestSignal,
  positionSide: BacktestTradeDirection | null,
): BacktestSignalAction | null {
  if (signal.action) return signal.action;
  if (signal.type === "buy") {
    return positionSide === "SHORT" ? "close_short" : "open_long";
  }
  if (signal.type === "sell") {
    return positionSide === "LONG" ? "close_long" : "open_short";
  }
  return null;
}

function positionEquity(input: {
  positionSide: BacktestTradeDirection;
  cash: number;
  shares: number;
  entryPrice: number;
  price: number;
}): number {
  if (input.positionSide === "LONG") {
    return input.cash + input.shares * input.price;
  }
  return input.cash + input.shares * (input.entryPrice - input.price);
}

function runSpotAccumulationBacktest(input: {
  aligned: AlignedSeries;
  lookback: BacktestLookbackId;
  customStrategy: CustomStrategy;
  initialCapital: number;
  stopLossPct: number;
  takeProfitPct: number;
  usedMockData?: boolean;
}): BacktestResult {
  const { aligned, lookback, customStrategy, initialCapital, stopLossPct, takeProfitPct } = input;
  const { dates, closes, highs, lows, benchmarkCloses, sp500Closes, timeframe } = aligned;
  const risk = resolveCustomRiskPct(customStrategy, stopLossPct, takeProfitPct);
  const buyPct = Math.min(100, Math.max(1, customStrategy.spotBuyPctOfCash ?? 25)) / 100;
  const buySignals = generateCustomStrategySignals(customStrategy, closes, dates);
  const buyDates = new Set(buySignals.map((signal) => signal.date));

  let cash = initialCapital;
  let totalUnits = 0;
  let totalInvested = 0;
  let buysExecutedCount = 0;
  let liquidations = 0;

  const fullCurve: BacktestEquityPoint[] = [];
  const dailyReturns: number[] = [];
  const executedSignals: BacktestSignal[] = [];
  const completedTrades: BacktestTradeRecord[] = [];
  let cycleStartDate: string | null = null;
  let cycleStartIndex = 0;

  const benchStart = benchmarkCloses[0] ?? 1;
  const stockStart = closes[0] ?? 1;
  const sp500Start = sp500Closes[0] ?? 1;
  let prevEquity = initialCapital;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    const price = closes[index]!;
    const high = highs[index] ?? price;
    const low = lows[index] ?? price;
    const benchPrice = benchmarkCloses[index]!;
    const averageCostBasis = totalUnits > 0 ? totalInvested / totalUnits : 0;

    if (totalUnits > 0 && averageCostBasis > 0) {
      const stopExit = resolveStopExitPrice({
        direction: "LONG",
        entryPrice: averageCostBasis,
        stopLossPct: risk.stopLossPct,
        takeProfitPct: risk.takeProfitPct,
        close: price,
        high,
        low,
      });
      if (stopExit) {
        const proceeds = totalUnits * stopExit.price * (1 - TRADING_FEE_RATE);
        const pnlDollar = proceeds - totalInvested;
        pushTradeRecord(completedTrades, {
          direction: "LONG",
          entryDate: cycleStartDate ?? date,
          entryPrice: averageCostBasis,
          exitDate: date,
          exitPrice: stopExit.price,
          pnlDollar,
          entryEquity: totalInvested,
          entryIndex: cycleStartIndex,
          exitIndex: index,
        });
        cash += proceeds;
        totalUnits = 0;
        totalInvested = 0;
        cycleStartDate = null;
        liquidations += 1;
        executedSignals.push({ date, type: "sell", price: stopExit.price });
      }
    }

    if (buyDates.has(date) && cash > 0) {
      const deployCash = cash * buyPct;
      if (deployCash > 0) {
        if (cycleStartDate == null) {
          cycleStartDate = date;
          cycleStartIndex = index;
        }
        const units = (deployCash * (1 - TRADING_FEE_RATE)) / price;
        totalUnits += units;
        totalInvested += deployCash;
        cash -= deployCash;
        buysExecutedCount += 1;
        executedSignals.push({ date, type: "buy", price });
      }
    }

    const strategyEquity = cash + totalUnits * price;
    const benchmarkEquity = initialCapital * (benchPrice / benchStart);
    const buyHoldEquity = initialCapital * (price / stockStart);
    const sp500Price = sp500Closes[index] ?? sp500Start;
    const sp500Equity = initialCapital * (sp500Price / sp500Start);

    fullCurve.push({
      date,
      strategy: strategyEquity,
      benchmark: benchmarkEquity,
      buyHold: buyHoldEquity,
      sp500Equity,
      cash,
    });

    if (index > 0 && prevEquity > 0) {
      dailyReturns.push((strategyEquity - prevEquity) / prevEquity);
    }
    prevEquity = strategyEquity;
  }

  const windowBars = backtestEvaluationBars(lookback, timeframe);
  const windowStart = Math.max(0, fullCurve.length - windowBars);
  const equityCurve = normalizeWindowCurve(fullCurve, windowStart, initialCapital);
  const windowReturns = dailyReturns.slice(Math.max(0, dailyReturns.length - windowBars));
  const annualization = barsPerYear(timeframe);

  const sp500WindowStart = aligned.sp500Closes[windowStart] ?? aligned.sp500Closes[0] ?? 1;
  const sp500End = aligned.sp500Closes.at(-1) ?? sp500WindowStart;
  const sp500ReturnPct =
    sp500WindowStart > 0 ? ((sp500End - sp500WindowStart) / sp500WindowStart) * 100 : 0;

  const windowSignals = executedSignals.filter(
    (signal) => equityCurve.some((point) => point.date === signal.date),
  );
  const windowTrades = completedTrades.filter((trade) =>
    equityCurve.some((point) => point.date === trade.exitDate),
  );
  const windowBuys = windowSignals.filter((signal) => signal.type === "buy").length;
  const spotWins = windowTrades.filter((trade) => trade.pnlDollar > 0);
  const spotLosses = windowTrades.filter((trade) => trade.pnlDollar < 0);
  const spotGrossProfit = spotWins.reduce((sum, trade) => sum + trade.pnlDollar, 0);
  const spotGrossLoss = Math.abs(spotLosses.reduce((sum, trade) => sum + trade.pnlDollar, 0));

  const finalStrategy = equityCurve.at(-1)?.strategy ?? initialCapital;
  const finalBenchmark = equityCurve.at(-1)?.benchmark ?? initialCapital;
  const finalBuyHold = equityCurve.at(-1)?.buyHold ?? initialCapital;
  const lastPrice = closes.at(-1) ?? 0;
  const finalAcb = totalUnits > 0 ? totalInvested / totalUnits : 0;
  const unrealizedPnlPct =
    totalUnits > 0 && finalAcb > 0 ? ((lastPrice - finalAcb) / finalAcb) * 100 : 0;

  return {
    equityCurve,
    signals: windowSignals,
    trades: windowTrades,
    usedMockData: input.usedMockData ?? false,
    metrics: {
      totalReturnPct: ((finalStrategy - initialCapital) / initialCapital) * 100,
      benchmarkReturnPct: ((finalBenchmark - initialCapital) / initialCapital) * 100,
      buyHoldReturnPct: ((finalBuyHold - initialCapital) / initialCapital) * 100,
      sp500ReturnPct,
      winRatePct: windowTrades.length ? (spotWins.length / windowTrades.length) * 100 : 0,
      totalTrades: liquidations,
      profitFactor:
        spotGrossLoss > 0
          ? spotGrossProfit / spotGrossLoss
          : spotGrossProfit > 0
            ? 999
            : 0,
      maxDrawdownPct: maxDrawdownPct(equityCurve.map((point) => point.strategy)),
      sharpeRatio: sharpeRatio(windowReturns, annualization),
      executionMode: "SPOT_ACCUMULATION",
      buysExecutedCount: windowBuys,
      averageCostBasis: finalAcb,
      unrealizedPnlPct,
      totalUnitsHeld: totalUnits,
    },
  };
}

export function runBacktest(input: {
  aligned: AlignedSeries;
  lookback: BacktestLookbackId;
  strategy: BacktestStrategyId;
  customStrategy?: CustomStrategy | null;
  initialCapital: number;
  stopLossPct: number;
  takeProfitPct: number;
  usedMockData?: boolean;
  /** Precomputed signals — reserved for future server-side overrides. */
  overrideSignals?: BacktestSignal[] | null;
}): BacktestResult {
  if (input.customStrategy && isSpotAccumulationStrategy(input.customStrategy)) {
    return runSpotAccumulationBacktest({
      aligned: input.aligned,
      lookback: input.lookback,
      customStrategy: input.customStrategy,
      initialCapital: input.initialCapital,
      stopLossPct: input.stopLossPct,
      takeProfitPct: input.takeProfitPct,
      usedMockData: input.usedMockData,
    });
  }

  const { aligned, lookback, strategy, customStrategy, initialCapital, stopLossPct, takeProfitPct } =
    input;
  const { dates, closes, highs, lows, benchmarkCloses, sp500Closes, timeframe } = aligned;
  const risk = resolveCustomRiskPct(customStrategy, stopLossPct, takeProfitPct);
  const signalEvents = input.overrideSignals
    ? input.overrideSignals
    : customStrategy
      ? generateCustomStrategySignals(customStrategy, closes, dates)
      : generateSignals(strategy, closes, dates);

  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryEquity = initialCapital;
  let entryDate = "";
  let entryIndex = 0;
  let inPosition = false;
  let positionSide: BacktestTradeDirection | null = null;

  const fullCurve: BacktestEquityPoint[] = [];
  const tradePnls: number[] = [];
  const dailyReturns: number[] = [];
  const executedSignals: BacktestSignal[] = [];
  const completedTrades: BacktestTradeRecord[] = [];

  const benchStart = benchmarkCloses[0] ?? 1;
  const stockStart = closes[0] ?? 1;
  const sp500Start = sp500Closes[0] ?? 1;
  let prevEquity = initialCapital;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    const price = closes[index]!;
    const high = highs[index] ?? price;
    const low = lows[index] ?? price;
    const benchPrice = benchmarkCloses[index]!;
    const pendingSignals = signalEvents.filter((signal) => signal.date === date);

    if (inPosition && positionSide) {
      const stopExit = resolveStopExitPrice({
        direction: positionSide,
        entryPrice,
        stopLossPct: risk.stopLossPct,
        takeProfitPct: risk.takeProfitPct,
        close: price,
        high,
        low,
      });
      if (stopExit) {
        const closingSide = positionSide;
        if (positionSide === "LONG") {
          const sold = executeSell({ shares, price: stopExit.price, entryEquity, tradePnls });
          pushTradeRecord(completedTrades, {
            direction: "LONG",
            entryDate,
            entryPrice,
            exitDate: date,
            exitPrice: stopExit.price,
            pnlDollar: sold.pnlDollar,
            entryEquity,
            entryIndex,
            exitIndex: index,
          });
          cash = sold.cash;
          shares = sold.shares;
          inPosition = sold.inPosition;
        } else {
          const closed = executeCloseShort({
            shares,
            price: stopExit.price,
            entryPrice,
            entryEquity,
            tradePnls,
          });
          pushTradeRecord(completedTrades, {
            direction: "SHORT",
            entryDate,
            entryPrice,
            exitDate: date,
            exitPrice: stopExit.price,
            pnlDollar: closed.pnlDollar,
            entryEquity,
            entryIndex,
            exitIndex: index,
          });
          cash = closed.cash;
          shares = closed.shares;
          inPosition = closed.inPosition;
        }
        positionSide = null;
        executedSignals.push({
          date,
          type: closingSide === "LONG" ? "sell" : "buy",
          price: stopExit.price,
          action: closingSide === "LONG" ? "close_long" : "close_short",
        });
      }
    }

    for (const pending of pendingSignals) {
      const action = resolveSignalAction(pending, positionSide);

      if (action === "open_long" && !inPosition && cash > 0) {
        entryEquity = cash;
        shares = (cash * (1 - TRADING_FEE_RATE)) / price;
        cash = 0;
        entryPrice = price;
        entryDate = date;
        entryIndex = index;
        inPosition = true;
        positionSide = "LONG";
        executedSignals.push({ ...pending, action: "open_long" });
      } else if (action === "open_short" && !inPosition && cash > 0) {
        entryEquity = cash;
        shares = (cash * (1 - TRADING_FEE_RATE)) / price;
        cash = entryEquity;
        entryPrice = price;
        entryDate = date;
        entryIndex = index;
        inPosition = true;
        positionSide = "SHORT";
        executedSignals.push({ ...pending, action: "open_short" });
      } else if (action === "close_long" && inPosition && positionSide === "LONG") {
        const sold = executeSell({ shares, price, entryEquity, tradePnls });
        pushTradeRecord(completedTrades, {
          direction: "LONG",
          entryDate,
          entryPrice,
          exitDate: date,
          exitPrice: price,
          pnlDollar: sold.pnlDollar,
          entryEquity,
          entryIndex,
          exitIndex: index,
        });
        cash = sold.cash;
        shares = sold.shares;
        inPosition = sold.inPosition;
        positionSide = null;
        executedSignals.push({ ...pending, action: "close_long" });
      } else if (action === "close_short" && inPosition && positionSide === "SHORT") {
        const closed = executeCloseShort({
          shares,
          price,
          entryPrice,
          entryEquity,
          tradePnls,
        });
        pushTradeRecord(completedTrades, {
          direction: "SHORT",
          entryDate,
          entryPrice,
          exitDate: date,
          exitPrice: price,
          pnlDollar: closed.pnlDollar,
          entryEquity,
          entryIndex,
          exitIndex: index,
        });
        cash = closed.cash;
        shares = closed.shares;
        inPosition = closed.inPosition;
        positionSide = null;
        executedSignals.push({ ...pending, action: "close_short" });
      }
    }

    const strategyEquity = inPosition && positionSide
      ? positionEquity({ positionSide, cash, shares, entryPrice, price })
      : cash;
    const benchmarkEquity = initialCapital * (benchPrice / benchStart);
    const buyHoldEquity = initialCapital * (price / stockStart);
    const sp500Price = sp500Closes[index] ?? sp500Start;
    const sp500Equity = initialCapital * (sp500Price / sp500Start);

    fullCurve.push({
      date,
      strategy: strategyEquity,
      benchmark: benchmarkEquity,
      buyHold: buyHoldEquity,
      sp500Equity,
      cash,
    });

    if (index > 0 && prevEquity > 0) {
      dailyReturns.push((strategyEquity - prevEquity) / prevEquity);
    }
    prevEquity = strategyEquity;
  }

  const windowBars = backtestEvaluationBars(lookback, timeframe);
  const windowStart = Math.max(0, fullCurve.length - windowBars);
  const equityCurve = normalizeWindowCurve(fullCurve, windowStart, initialCapital);
  const windowReturns = dailyReturns.slice(Math.max(0, dailyReturns.length - windowBars));
  const annualization = barsPerYear(timeframe);

  const sp500WindowStart = aligned.sp500Closes[windowStart] ?? aligned.sp500Closes[0] ?? 1;
  const sp500End = aligned.sp500Closes.at(-1) ?? sp500WindowStart;
  const sp500ReturnPct =
    sp500WindowStart > 0 ? ((sp500End - sp500WindowStart) / sp500WindowStart) * 100 : 0;

  const windowSignals = executedSignals.filter(
    (signal) => equityCurve.some((point) => point.date === signal.date),
  );
  const windowTrades = completedTrades.filter((trade) =>
    equityCurve.some((point) => point.date === trade.exitDate),
  );

  const finalStrategy = equityCurve.at(-1)?.strategy ?? initialCapital;
  const finalBenchmark = equityCurve.at(-1)?.benchmark ?? initialCapital;
  const finalBuyHold = equityCurve.at(-1)?.buyHold ?? initialCapital;

  const wins = tradePnls.filter((value) => value > 0);
  const losses = tradePnls.filter((value) => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));

  return {
    equityCurve,
    signals: windowSignals,
    trades: windowTrades,
    usedMockData: input.usedMockData ?? false,
    metrics: {
      totalReturnPct: ((finalStrategy - initialCapital) / initialCapital) * 100,
      benchmarkReturnPct: ((finalBenchmark - initialCapital) / initialCapital) * 100,
      buyHoldReturnPct: ((finalBuyHold - initialCapital) / initialCapital) * 100,
      sp500ReturnPct,
      winRatePct: tradePnls.length ? (wins.length / tradePnls.length) * 100 : 0,
      totalTrades: tradePnls.length,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
      maxDrawdownPct: maxDrawdownPct(equityCurve.map((point) => point.strategy)),
      sharpeRatio: sharpeRatio(windowReturns, annualization),
      executionMode: "STANDARD",
    },
  };
}

export function lookbackDays(id: BacktestLookbackId): number {
  return BACKTEST_LOOKBACKS.find((option) => option.id === id)?.days ?? 365;
}

export function lookbackFetchCalendarDays(id: BacktestLookbackId): number {
  return BACKTEST_FETCH_DAYS[id];
}
