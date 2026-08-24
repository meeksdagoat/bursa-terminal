import type { Candle } from "./types";

export type TechnicalAction = "strong-sell" | "sell" | "neutral" | "buy" | "strong-buy";

export type IndicatorRow = {
  id: string;
  group: "oscillator" | "ma";
  label: string;
  value: number | null;
  display: string;
  action: "sell" | "neutral" | "buy";
};

export type TechnicalSummary = {
  score: number;
  rating: TechnicalAction;
  oscillators: { sell: number; neutral: number; buy: number };
  movingAverages: { sell: number; neutral: number; buy: number };
  rows: IndicatorRow[];
};

export const RATING_LABEL: Record<TechnicalAction, string> = {
  "strong-sell": "STRONG SELL",
  sell: "SELL",
  neutral: "NEUTRAL",
  buy: "BUY",
  "strong-buy": "STRONG BUY",
};

export const ACTION_LABEL: Record<"sell" | "neutral" | "buy", string> = {
  sell: "Sell",
  neutral: "Neutral",
  buy: "Buy",
};

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i += 1) sum += values[i];
  return sum / period;
}

function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  const last = series[series.length - 1];
  return Number.isFinite(last) ? last : null;
}

function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = Array.from({ length: values.length }, () => Number.NaN);
  if (values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += values[i];
  out[period - 1] = seed / period;

  for (let i = period; i < values.length; i += 1) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function stochastic(candles: Candle[], period = 14): number | null {
  if (candles.length < period) return null;
  const window = candles.slice(-period);
  let highest = -Infinity;
  let lowest = Infinity;
  for (const candle of window) {
    if (candle.high > highest) highest = candle.high;
    if (candle.low < lowest) lowest = candle.low;
  }
  const span = highest - lowest;
  if (span <= 0) return 50;
  return ((window[window.length - 1].close - lowest) / span) * 100;
}

function macdLine(closes: number[]): { macd: number; signal: number } | null {
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const macdSeries: number[] = [];

  for (let i = 0; i < closes.length; i += 1) {
    if (Number.isFinite(fast[i]) && Number.isFinite(slow[i])) {
      macdSeries.push(fast[i] - slow[i]);
    }
  }

  if (macdSeries.length < 9) return null;
  const signal = ema(macdSeries, 9);
  if (signal == null) return null;
  return { macd: macdSeries[macdSeries.length - 1], signal };
}

function oscillatorAction(kind: "rsi" | "stoch" | "macd", value: number, extra?: number): "sell" | "neutral" | "buy" {
  if (kind === "rsi") {
    if (value >= 70) return "sell";
    if (value <= 30) return "buy";
    return "neutral";
  }
  if (kind === "stoch") {
    if (value >= 80) return "sell";
    if (value <= 20) return "buy";
    return "neutral";
  }
  return extra != null && value > extra ? "buy" : extra != null && value < extra ? "sell" : "neutral";
}

function maAction(price: number, ma: number): "sell" | "neutral" | "buy" {
  const gap = (price - ma) / ma;
  if (Math.abs(gap) < 0.001) return "neutral";
  return price > ma ? "buy" : "sell";
}

function tally(rows: IndicatorRow[]): { sell: number; neutral: number; buy: number } {
  const counts = { sell: 0, neutral: 0, buy: 0 };
  for (const row of rows) counts[row.action] += 1;
  return counts;
}

/** Five equal 36° bands on the −90°…+90° gauge. Gray (neutral) is |score| ≤ 0.2. */
function ratingFromScore(score: number): TechnicalAction {
  if (score <= -0.6) return "strong-sell";
  if (score < -0.2) return "sell";
  if (score >= 0.6) return "strong-buy";
  if (score > 0.2) return "buy";
  return "neutral";
}

function fmt(value: number | null, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

/**
 * TradingView-style vote: each oscillator and MA casts sell / neutral / buy.
 * Daily candles from the 1Y feed are enough for SMA 200 on Bursa names.
 */
export function summariseTechnicals(candles: Candle[]): TechnicalSummary | null {
  const closes = candles.map((candle) => candle.close);
  if (closes.length < 30) return null;

  const last = closes[closes.length - 1];
  const rsi14 = rsi(closes, 14);
  const stoch = stochastic(candles, 14);
  const macd = macdLine(closes);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);

  const rows: IndicatorRow[] = [];

  if (rsi14 != null) {
    rows.push({
      id: "rsi14",
      group: "oscillator",
      label: "RSI (14)",
      value: rsi14,
      display: fmt(rsi14, 1),
      action: oscillatorAction("rsi", rsi14),
    });
  }

  if (stoch != null) {
    rows.push({
      id: "stoch14",
      group: "oscillator",
      label: "Stochastic (14)",
      value: stoch,
      display: fmt(stoch, 1),
      action: oscillatorAction("stoch", stoch),
    });
  }

  if (macd != null) {
    rows.push({
      id: "macd",
      group: "oscillator",
      label: "MACD (12, 26)",
      value: macd.macd,
      display: `${fmt(macd.macd, 4)} / ${fmt(macd.signal, 4)}`,
      action: oscillatorAction("macd", macd.macd, macd.signal),
    });
  }

  const mas: Array<{ id: string; label: string; value: number | null }> = [
    { id: "sma20", label: "SMA 20", value: sma20 },
    { id: "sma50", label: "SMA 50", value: sma50 },
    { id: "sma200", label: "SMA 200", value: sma200 },
    { id: "ema20", label: "EMA 20", value: ema20 },
    { id: "ema50", label: "EMA 50", value: ema50 },
  ];

  for (const ma of mas) {
    if (ma.value == null) continue;
    rows.push({
      id: ma.id,
      group: "ma",
      label: ma.label,
      value: ma.value,
      display: fmt(ma.value, 2),
      action: maAction(last, ma.value),
    });
  }

  if (rows.length === 0) return null;

  const oscillators = tally(rows.filter((row) => row.group === "oscillator"));
  const movingAverages = tally(rows.filter((row) => row.group === "ma"));
  const all = tally(rows);
  const decided = all.buy + all.sell;
  const score = decided === 0 ? 0 : (all.buy - all.sell) / (all.buy + all.sell + all.neutral);

  return {
    score,
    rating: ratingFromScore(score),
    oscillators,
    movingAverages,
    rows,
  };
}
