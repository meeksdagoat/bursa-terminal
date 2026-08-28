/** Client-safe historical backtesting utilities. */

import { normalizeTradingDate, unixToDate } from "@/lib/quant/math";
import type { DailyClose } from "@/lib/types";

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

export type BacktestSignal = {
  date: string;
  type: "buy" | "sell";
  price: number;
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
};

export type BacktestResult = {
  equityCurve: BacktestEquityPoint[];
  signals: BacktestSignal[];
  metrics: BacktestMetrics;
  usedMockData: boolean;
};

export type AlignedSeries = {
  dates: string[];
  closes: number[];
  benchmarkCloses: number[];
  sp500Closes: number[];
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
    return {
      ...aligned,
      sp500Closes: forwardFillOnDates(aligned.dates, sorted, fallback),
    };
  }

  const mock = generateMockCloses(aligned.dates.length, fallback, 0.00035, 0.012, seed + 211);
  return {
    ...aligned,
    sp500Closes: forwardFillOnDates(aligned.dates, mock, fallback),
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
    benchmarkCloses,
    sp500Closes: forwardFillOnDates(dates, [], lastBench),
  };
}

export function prepareBacktestData(input: {
  symbol: string;
  stockPoints: DailyClose[];
  benchmarkPoints: DailyClose[];
  sp500Points: DailyClose[];
  lookback: BacktestLookbackId;
}): { aligned: AlignedSeries; usedMockData: boolean } {
  const fetchTarget = BACKTEST_FETCH_DAYS[input.lookback];
  const seed = hashSeed(`${input.symbol}:${input.lookback}`);
  const stockStart =
    sortDailyCloses(input.stockPoints).at(-1)?.close ??
    sortDailyCloses(input.stockPoints).at(0)?.close ??
    10;

  let usedMockData = false;
  let stock = sortDailyCloses(input.stockPoints);
  let benchmark = sortDailyCloses(input.benchmarkPoints);
  let sp500 = sortDailyCloses(input.sp500Points);

  if (stock.length < 30) {
    stock = generateMockCloses(fetchTarget, stockStart, 0.00025, 0.018, seed);
    benchmark = generateMockCloses(fetchTarget, 1520, 0.00012, 0.011, seed + 99);
    sp500 = generateMockCloses(fetchTarget, 5200, 0.00035, 0.012, seed + 199);
    usedMockData = true;
  } else if (benchmark.length < 20) {
    benchmark = deriveBenchmarkFromStock(stock, seed);
  }

  let aligned = alignWithForwardFill(stock, benchmark);
  if (!aligned || aligned.dates.length < 30) {
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
      benchmarkCloses: aligned.benchmarkCloses.slice(start),
      sp500Closes: aligned.sp500Closes.slice(start),
    };
  }

  return { aligned, usedMockData };
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

function sharpeRatio(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, dailyReturns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
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

function executeSell(input: {
  shares: number;
  price: number;
  entryEquity: number;
  tradePnls: number[];
}): { cash: number; shares: number; inPosition: false } {
  const cash = input.shares * input.price * (1 - TRADING_FEE_RATE);
  input.tradePnls.push(cash - input.entryEquity);
  return { cash, shares: 0, inPosition: false };
}

export function runBacktest(input: {
  aligned: AlignedSeries;
  lookback: BacktestLookbackId;
  strategy: BacktestStrategyId;
  initialCapital: number;
  stopLossPct: number;
  takeProfitPct: number;
  usedMockData?: boolean;
}): BacktestResult {
  const { aligned, lookback, strategy, initialCapital, stopLossPct, takeProfitPct } = input;
  const { dates, closes, benchmarkCloses, sp500Closes } = aligned;
  const signalEvents = generateSignals(strategy, closes, dates);

  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryEquity = initialCapital;
  let inPosition = false;

  const fullCurve: BacktestEquityPoint[] = [];
  const tradePnls: number[] = [];
  const dailyReturns: number[] = [];
  const executedSignals: BacktestSignal[] = [];

  const benchStart = benchmarkCloses[0] ?? 1;
  const stockStart = closes[0] ?? 1;
  const sp500Start = sp500Closes[0] ?? 1;
  let prevEquity = initialCapital;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    const price = closes[index]!;
    const benchPrice = benchmarkCloses[index]!;
    const pending = signalEvents.find((signal) => signal.date === date);

    if (inPosition) {
      const movePct = ((price - entryPrice) / entryPrice) * 100;
      if (stopLossPct > 0 && movePct <= -stopLossPct) {
        const sold = executeSell({ shares, price, entryEquity, tradePnls });
        cash = sold.cash;
        shares = sold.shares;
        inPosition = sold.inPosition;
        executedSignals.push({ date, type: "sell", price });
      } else if (takeProfitPct > 0 && movePct >= takeProfitPct) {
        const sold = executeSell({ shares, price, entryEquity, tradePnls });
        cash = sold.cash;
        shares = sold.shares;
        inPosition = sold.inPosition;
        executedSignals.push({ date, type: "sell", price });
      }
    }

    if (pending) {
      if (pending.type === "buy" && !inPosition && cash > 0) {
        entryEquity = cash;
        shares = (cash * (1 - TRADING_FEE_RATE)) / price;
        cash = 0;
        entryPrice = price;
        inPosition = true;
        executedSignals.push(pending);
      } else if (pending.type === "sell" && inPosition) {
        const sold = executeSell({ shares, price, entryEquity, tradePnls });
        cash = sold.cash;
        shares = sold.shares;
        inPosition = sold.inPosition;
        executedSignals.push(pending);
      }
    }

    const strategyEquity = cash + shares * price;
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

  const windowDays = BACKTEST_TRADING_DAYS[lookback];
  const windowStart = Math.max(0, fullCurve.length - windowDays);
  const equityCurve = normalizeWindowCurve(fullCurve, windowStart, initialCapital);
  const windowReturns = dailyReturns.slice(Math.max(0, dailyReturns.length - windowDays));

  const sp500WindowStart = aligned.sp500Closes[windowStart] ?? aligned.sp500Closes[0] ?? 1;
  const sp500End = aligned.sp500Closes.at(-1) ?? sp500WindowStart;
  const sp500ReturnPct =
    sp500WindowStart > 0 ? ((sp500End - sp500WindowStart) / sp500WindowStart) * 100 : 0;

  const windowSignals = executedSignals.filter(
    (signal) => equityCurve.some((point) => point.date === signal.date),
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
      sharpeRatio: sharpeRatio(windowReturns),
    },
  };
}

export function lookbackDays(id: BacktestLookbackId): number {
  return BACKTEST_LOOKBACKS.find((option) => option.id === id)?.days ?? 365;
}

export function lookbackFetchCalendarDays(id: BacktestLookbackId): number {
  return BACKTEST_FETCH_DAYS[id];
}
