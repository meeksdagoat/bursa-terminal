import type { BacktestSignal } from "./backtest";
import type { Condition, CustomStrategy } from "./custom-strategy";

type IndicatorSide = Condition["indicatorA"] | Condition["indicatorB"];

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function ema(values: number[], period: number): number[] {
  const output = Array(values.length).fill(Number.NaN);
  if (values.length < period) return output;

  let seed = 0;
  for (let index = 0; index < period; index += 1) seed += values[index]!;
  let prev = seed / period;
  output[period - 1] = prev;

  const k = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    prev = values[index]! * k + prev * (1 - k);
    output[index] = prev;
  }

  return output;
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

function estimateVolume(closes: number[]): number[] {
  return closes.map((_, index) => {
    if (index === 0) return 1_000_000;
    const prev = closes[index - 1]!;
    const curr = closes[index]!;
    const move = prev > 0 ? Math.abs((curr - prev) / prev) : 0;
    return 1_000_000 * (1 + move * 40);
  });
}

type IndicatorCache = {
  sma: Map<string, (number | null)[]>;
  ema: Map<string, number[]>;
  rsi: Map<string, (number | null)[]>;
  volume: number[];
};

function buildIndicatorCache(closes: number[]): IndicatorCache {
  return {
    sma: new Map(),
    ema: new Map(),
    rsi: new Map(),
    volume: estimateVolume(closes),
  };
}

function seriesFor(
  kind: IndicatorSide,
  period: number,
  closes: number[],
  cache: IndicatorCache,
): (number | null)[] | number[] {
  if (kind === "PRICE") return closes;
  if (kind === "VOLUME") return cache.volume;

  const key = String(period);
  if (kind === "SMA") {
    if (!cache.sma.has(key)) cache.sma.set(key, sma(closes, period));
    return cache.sma.get(key)!;
  }
  if (kind === "EMA") {
    if (!cache.ema.has(key)) cache.ema.set(key, ema(closes, period));
    return cache.ema.get(key)!;
  }
  if (!cache.rsi.has(key)) cache.rsi.set(key, rsi(closes, period));
  return cache.rsi.get(key)!;
}

function readIndicatorValue(
  kind: IndicatorSide,
  period: number,
  valueB: number,
  index: number,
  closes: number[],
  cache: IndicatorCache,
): number | null {
  if (kind === "VALUE") return valueB;

  const series = seriesFor(kind, period, closes, cache);
  const value = series[index];
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

function compareValues(
  operator: Condition["operator"],
  currentA: number,
  currentB: number,
  prevA: number | null,
  prevB: number | null,
): boolean {
  switch (operator) {
    case ">":
      return currentA > currentB;
    case "<":
      return currentA < currentB;
    case "CROSSES_ABOVE":
      return prevA != null && prevB != null && prevA <= prevB && currentA > currentB;
    case "CROSSES_BELOW":
      return prevA != null && prevB != null && prevA >= prevB && currentA < currentB;
    default:
      return false;
  }
}

function evaluateCondition(
  condition: Condition,
  index: number,
  closes: number[],
  cache: IndicatorCache,
): boolean {
  if (index < 1 && (condition.operator === "CROSSES_ABOVE" || condition.operator === "CROSSES_BELOW")) {
    return false;
  }

  const currentA = readIndicatorValue(
    condition.indicatorA,
    condition.periodA,
    condition.valueB,
    index,
    closes,
    cache,
  );
  const currentB = readIndicatorValue(
    condition.indicatorB,
    condition.periodB,
    condition.valueB,
    index,
    closes,
    cache,
  );

  if (currentA == null || currentB == null) return false;

  const prevA =
    index > 0
      ? readIndicatorValue(condition.indicatorA, condition.periodA, condition.valueB, index - 1, closes, cache)
      : null;
  const prevB =
    index > 0
      ? readIndicatorValue(condition.indicatorB, condition.periodB, condition.valueB, index - 1, closes, cache)
      : null;

  return compareValues(condition.operator, currentA, currentB, prevA, prevB);
}

function evaluateAllConditions(
  conditions: Condition[],
  index: number,
  closes: number[],
  cache: IndicatorCache,
): boolean {
  if (conditions.length === 0) return false;
  return conditions.every((condition) => evaluateCondition(condition, index, closes, cache));
}

export function generateCustomStrategySignals(
  strategy: CustomStrategy,
  closes: number[],
  dates: string[],
): BacktestSignal[] {
  if (strategy.executionType === "SPOT_ACCUMULATION") {
    return generateSpotAccumulationBuySignals(strategy, closes, dates);
  }

  const signals: BacktestSignal[] = [];
  const cache = buildIndicatorCache(closes);
  let positionSide: "LONG" | "SHORT" | null = null;

  for (let index = 1; index < closes.length; index += 1) {
    const date = dates[index]!;
    const price = closes[index]!;
    const buyHit = evaluateAllConditions(strategy.buyConditions, index, closes, cache);
    const sellHit = evaluateAllConditions(strategy.sellConditions, index, closes, cache);

    if (positionSide === "LONG" && sellHit) {
      signals.push({ date, type: "sell", price, action: "close_long" });
      positionSide = null;
    } else if (positionSide === null && sellHit) {
      signals.push({ date, type: "sell", price, action: "open_short" });
      positionSide = "SHORT";
    }

    if (positionSide === "SHORT" && buyHit) {
      signals.push({ date, type: "buy", price, action: "close_short" });
      positionSide = null;
    }

    if (positionSide === null && buyHit) {
      signals.push({ date, type: "buy", price, action: "open_long" });
      positionSide = "LONG";
    }
  }

  return signals;
}

/** Emits a buy signal on every bar where buy conditions pass — no sell-on-reversal. */
export function generateSpotAccumulationBuySignals(
  strategy: CustomStrategy,
  closes: number[],
  dates: string[],
): BacktestSignal[] {
  const signals: BacktestSignal[] = [];
  const cache = buildIndicatorCache(closes);

  for (let index = 1; index < closes.length; index += 1) {
    const buyHit = evaluateAllConditions(strategy.buyConditions, index, closes, cache);
    if (buyHit) {
      signals.push({ date: dates[index]!, type: "buy", price: closes[index]! });
    }
  }

  return signals;
}

export function resolveCustomRiskPct(
  strategy: CustomStrategy | null | undefined,
  fallbackStop: number,
  fallbackTake: number,
): { stopLossPct: number; takeProfitPct: number } {
  return {
    stopLossPct: strategy?.stopLossPct ?? fallbackStop,
    takeProfitPct: strategy?.takeProfitPct ?? fallbackTake,
  };
}
