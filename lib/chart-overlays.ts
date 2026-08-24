import type { Candle } from "./types";

export type OverlayPoint = { time: number; value: number };
export type AlignedPoint = { time: number; value?: number };

export type MacdPoint = {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
};

export type VolumeBin = {
  price: number;
  volume: number;
  up: number;
  down: number;
};

export function toHeikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
    const prev = out[i - 1];
    const haOpen = prev ? (prev.open + prev.close) / 2 : (candle.open + candle.close) / 2;
    out.push({
      time: candle.time,
      open: haOpen,
      high: Math.max(candle.high, haOpen, haClose),
      low: Math.min(candle.low, haOpen, haClose),
      close: haClose,
      volume: candle.volume,
    });
  }
  return out;
}

function smaAt(values: number[], period: number, index: number): number | null {
  if (index + 1 < period) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i += 1) sum += values[i];
  return sum / period;
}

export function smaOverlay(candles: Candle[], period: number): OverlayPoint[] {
  const closes = candles.map((candle) => candle.close);
  const points: OverlayPoint[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const value = smaAt(closes, period, i);
    if (value == null) continue;
    points.push({ time: candles[i].time, value });
  }
  return points;
}

export function emaOverlay(candles: Candle[], period: number): OverlayPoint[] {
  const k = 2 / (period + 1);
  const points: OverlayPoint[] = [];
  let ema: number | null = null;
  let seed = 0;

  for (let i = 0; i < candles.length; i += 1) {
    const close = candles[i].close;
    if (i < period) {
      seed += close;
      if (i === period - 1) {
        ema = seed / period;
        points.push({ time: candles[i].time, value: ema });
      }
      continue;
    }
    ema = close * k + (ema ?? close) * (1 - k);
    points.push({ time: candles[i].time, value: ema });
  }

  return points;
}

export function rsiOverlay(candles: Candle[], period = 14): OverlayPoint[] {
  if (candles.length < period + 1) return [];

  const points: OverlayPoint[] = [];
  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta = candles[i].close - candles[i - 1].close;
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  const first = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  points.push({ time: candles[period].time, value: first });

  for (let i = period + 1; i < candles.length; i += 1) {
    const delta = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    points.push({ time: candles[i].time, value });
  }

  return points;
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

export function macdOverlay(candles: Candle[]): MacdPoint[] {
  const closes = candles.map((candle) => candle.close);
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const macdLine: Array<{ time: number; value: number }> = [];

  for (let i = 0; i < candles.length; i += 1) {
    if (!Number.isFinite(fast[i]) || !Number.isFinite(slow[i])) continue;
    macdLine.push({ time: candles[i].time, value: fast[i] - slow[i] });
  }

  const signal = emaSeries(
    macdLine.map((point) => point.value),
    9,
  );

  return macdLine.flatMap((point, index) => {
    if (!Number.isFinite(signal[index])) return [];
    return [
      {
        time: point.time,
        macd: point.value,
        signal: signal[index],
        histogram: point.value - signal[index],
      },
    ];
  });
}

export function volumeProfile(candles: Candle[], bins = 24): VolumeBin[] {
  if (candles.length === 0) return [];

  let low = Infinity;
  let high = -Infinity;
  for (const candle of candles) {
    if (candle.low < low) low = candle.low;
    if (candle.high > high) high = candle.high;
  }
  if (!(high > low)) return [];

  const step = (high - low) / bins;
  const rows: VolumeBin[] = Array.from({ length: bins }, (_, index) => ({
    price: low + (index + 0.5) * step,
    volume: 0,
    up: 0,
    down: 0,
  }));

  for (const candle of candles) {
    const typical = (candle.high + candle.low + candle.close) / 3;
    let index = Math.floor((typical - low) / step);
    if (index < 0) index = 0;
    if (index >= bins) index = bins - 1;
    const volume = candle.volume ?? 0;
    rows[index].volume += volume;
    if (candle.close >= candle.open) rows[index].up += volume;
    else rows[index].down += volume;
  }

  return rows;
}

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** Unix seconds. Accepts seconds, milliseconds, Date, or ISO/date strings. */
export function toUnixSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value > 1e11 ? value / 1000 : value);
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
  }
  if (typeof value === "string" && value.length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return Math.floor(numeric > 1e11 ? numeric / 1000 : numeric);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }
  return null;
}

export function sanitizeCandles(candles: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const candle of candles) {
    const time = toUnixSeconds(candle.time);
    if (time == null) continue;
    if (![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) continue;
    byTime.set(time, { ...candle, time });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Map sparse indicator samples onto the candle time axis. Missing values become
 * whitespace so the series stays index-aligned with the main chart.
 */
export function alignToTimes(
  times: number[],
  points: ReadonlyArray<{ time: number; value: number }>,
): AlignedPoint[] {
  const byTime = new Map<number, number>();
  for (const point of points) {
    const time = toUnixSeconds(point.time);
    if (time == null || !Number.isFinite(point.value)) continue;
    byTime.set(time, point.value);
  }
  return times.map((time) => {
    const value = byTime.get(time);
    return value == null ? { time } : { time, value };
  });
}
