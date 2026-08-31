/** Rolling 30D drift + volatility-clustering regime labels (HMM-style persistence). */

import { toIsoDateKey, uniqueBarsByIsoDate, type PriceBar } from "./client-history";

export const REGIME_WINDOW = 30;
export const REGIME_VOL_BASELINE = 90;
export const REGIME_MIN_RUN = 8;

export type MarketRegime = "bull" | "bear" | "volatile";

export type RegimePoint = {
  date: string;
  close: number;
  drift30: number;
  vol30: number;
  vol90: number;
  regime: MarketRegime;
  /** Dummy series for Recharts background bars (always 1). */
  band: number;
  idx: number;
};

export type RegimeSegment = {
  start: string;
  end: string;
  startIdx: number;
  endIdx: number;
  regime: MarketRegime;
};

export type RegimeResult = {
  points: RegimePoint[];
  segments: RegimeSegment[];
  latest: RegimePoint | null;
  counts: Record<MarketRegime, number>;
};

export const REGIME_COLORS: Record<MarketRegime, { fill: string; stroke: string; label: string }> = {
  bull: { fill: "rgba(16, 185, 129, 0.22)", stroke: "#34d399", label: "Bull" },
  bear: { fill: "rgba(244, 63, 94, 0.22)", stroke: "#fb7185", label: "Bear" },
  volatile: { fill: "rgba(251, 191, 36, 0.22)", stroke: "#fbbf24", label: "Volatile" },
};

function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1]!;
    const current = closes[index]!;
    out.push(previous > 0 ? (current - previous) / previous : 0);
  }
  return out;
}

function windowStd(returns: number[], endIndex: number, length: number): number {
  const start = Math.max(0, endIndex - length + 1);
  const slice = returns.slice(start, endIndex + 1);
  if (slice.length < 5) return 0;
  const avg = slice.reduce((sum, value) => sum + value, 0) / slice.length;
  const variance = slice.reduce((sum, value) => sum + (value - avg) ** 2, 0) / slice.length;
  return Math.sqrt(Math.max(0, variance)) * Math.sqrt(252);
}

function classify(drift30: number, vol30: number, vol90: number): MarketRegime {
  const clustered = vol90 > 0 ? vol30 > 1.35 * vol90 : false;
  const elevated = vol30 >= 0.28;
  if (clustered || elevated) return "volatile";
  if (drift30 >= 0) return "bull";
  return "bear";
}

function persistRegimes(raw: MarketRegime[], minRun: number): MarketRegime[] {
  const out = [...raw];
  let index = 0;
  while (index < out.length) {
    let end = index;
    while (end < out.length && out[end] === out[index]) end += 1;
    const run = end - index;
    if (run < minRun && index > 0) {
      const absorb = out[index - 1]!;
      for (let cursor = index; cursor < end; cursor += 1) out[cursor] = absorb;
    }
    index = end;
  }
  return out;
}

export function mergeRegimeSegments(points: RegimePoint[]): RegimeSegment[] {
  const segments: RegimeSegment[] = [];
  for (const point of points) {
    const last = segments.at(-1);
    if (last && last.regime === point.regime) {
      last.end = point.date;
      last.endIdx = point.idx;
    } else {
      segments.push({
        start: point.date,
        end: point.date,
        startIdx: point.idx,
        endIdx: point.idx,
        regime: point.regime,
      });
    }
  }
  for (let index = 0; index < segments.length - 1; index += 1) {
    const next = segments[index + 1]!;
    segments[index]!.end = next.start;
    segments[index]!.endIdx = next.startIdx;
  }
  return segments;
}

/**
 * Forward-fill (then back-fill the leading gap) so every price date has a regime.
 * Used when classified rows are shorter than the price series (warmup window).
 */
export function ffillRegimesToPrices(
  priceBars: PriceBar[],
  classified: Array<Omit<RegimePoint, "band" | "idx">>,
): RegimePoint[] {
  const byDate = new Map(classified.map((row) => [row.date, row]));
  const slots: Array<Omit<RegimePoint, "band" | "idx"> | null> = priceBars.map((bar) => {
    const hit = byDate.get(bar.date);
    if (!hit) return null;
    return { ...hit, date: bar.date, close: bar.close };
  });

  let carry: Omit<RegimePoint, "band" | "idx"> | null = null;
  for (let index = 0; index < slots.length; index += 1) {
    const current = slots[index];
    if (current) {
      carry = current;
    } else if (carry) {
      const bar = priceBars[index]!;
      slots[index] = {
        ...carry,
        date: bar.date,
        close: bar.close,
      };
    }
  }

  let lead: Omit<RegimePoint, "band" | "idx"> | null = null;
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const current = slots[index];
    if (current) {
      lead = current;
    } else if (lead) {
      const bar = priceBars[index]!;
      slots[index] = {
        ...lead,
        date: bar.date,
        close: bar.close,
      };
    }
  }

  return slots
    .map((row, idx) =>
      row
        ? {
            ...row,
            band: 1,
            idx,
          }
        : null,
    )
    .filter((row): row is RegimePoint => row != null);
}

export function classifyRegimes(bars: PriceBar[]): RegimeResult | null {
  const daily = uniqueBarsByIsoDate(
    bars.map((bar) => ({
      ...bar,
      date: toIsoDateKey(bar),
    })),
  );
  if (daily.length < REGIME_WINDOW + 2) return null;

  const closes = daily.map((bar) => bar.close);
  const returns = dailyReturns(closes);
  const raw: MarketRegime[] = [];
  const classified: Array<Omit<RegimePoint, "band" | "idx">> = [];

  for (let index = REGIME_WINDOW; index < daily.length; index += 1) {
    const returnIndex = index - 1;
    const base = closes[index - REGIME_WINDOW]!;
    const current = closes[index]!;
    const drift30 = base > 0 ? current / base - 1 : 0;
    const vol30 = windowStd(returns, returnIndex, REGIME_WINDOW);
    const vol90 = windowStd(returns, returnIndex, REGIME_VOL_BASELINE);
    raw.push(classify(drift30, vol30, vol90));
    classified.push({
      date: daily[index]!.date,
      close: current,
      drift30,
      vol30,
      vol90,
      regime: "bull",
    });
  }

  const smoothed = persistRegimes(raw, REGIME_MIN_RUN);
  const labeled = classified.map((row, index) => ({
    ...row,
    regime: smoothed[index] ?? row.regime,
  }));

  const points = ffillRegimesToPrices(daily, labeled);
  if (points.length === 0) return null;

  const counts: Record<MarketRegime, number> = { bull: 0, bear: 0, volatile: 0 };
  for (const point of points) counts[point.regime] += 1;

  return {
    points,
    segments: mergeRegimeSegments(points),
    latest: points.at(-1) ?? null,
    counts,
  };
}
