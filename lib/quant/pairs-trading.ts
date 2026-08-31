/** Rolling ratio / Z-score spread for statistical-arbitrage pairs. */

import type { PriceBar } from "./client-history";

export const PAIRS_Z_ENTRY = 2;
export const PAIRS_WINDOWS = [30, 60, 90] as const;
export type PairsWindow = (typeof PAIRS_WINDOWS)[number];

export type AlignedPairPoint = {
  date: string;
  priceA: number;
  priceB: number;
  ratio: number;
};

export type PairsZPoint = AlignedPairPoint & {
  mean: number;
  std: number;
  zScore: number;
};

export type PairsSignal = "long_spread" | "short_spread" | "neutral";

export type PairsResult = {
  window: PairsWindow;
  points: PairsZPoint[];
  latest: PairsZPoint | null;
  signal: PairsSignal;
  correlation: number | null;
};

export function alignPairBars(seriesA: PriceBar[], seriesB: PriceBar[]): AlignedPairPoint[] {
  const byDate = new Map(seriesB.map((bar) => [bar.date, bar.close]));
  const aligned: AlignedPairPoint[] = [];
  for (const bar of seriesA) {
    const priceB = byDate.get(bar.date);
    if (priceB == null || priceB <= 0 || bar.close <= 0) continue;
    aligned.push({
      date: bar.date,
      priceA: bar.close,
      priceB,
      ratio: bar.close / priceB,
    });
  }
  return aligned;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 10) return null;
  const n = xs.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index]! - meanX;
    const dy = ys[index]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;
  return numerator / denom;
}

export function rollingZScore(aligned: AlignedPairPoint[], window: PairsWindow): PairsResult {
  const points: PairsZPoint[] = [];

  for (let index = window - 1; index < aligned.length; index += 1) {
    const slice = aligned.slice(index - window + 1, index + 1);
    const ratios = slice.map((row) => row.ratio);
    const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    const variance =
      ratios.reduce((sum, value) => sum + (value - mean) ** 2, 0) / ratios.length;
    const std = Math.sqrt(Math.max(0, variance));
    const current = aligned[index]!;
    const zScore = std === 0 ? 0 : (current.ratio - mean) / std;
    points.push({ ...current, mean, std, zScore });
  }

  const latest = points.at(-1) ?? null;
  let signal: PairsSignal = "neutral";
  if (latest) {
    if (latest.zScore >= PAIRS_Z_ENTRY) signal = "short_spread";
    else if (latest.zScore <= -PAIRS_Z_ENTRY) signal = "long_spread";
  }

  const retA: number[] = [];
  const retB: number[] = [];
  for (let index = 1; index < aligned.length; index += 1) {
    const prev = aligned[index - 1]!;
    const cur = aligned[index]!;
    retA.push((cur.priceA - prev.priceA) / prev.priceA);
    retB.push((cur.priceB - prev.priceB) / prev.priceB);
  }

  return {
    window,
    points,
    latest,
    signal,
    correlation: pearson(retA.slice(-window), retB.slice(-window)),
  };
}
