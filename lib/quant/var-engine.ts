/** Parametric and historical Value-at-Risk — client-safe. */

export const VAR_HORIZONS = [1, 10, 30] as const;
export const VAR_CONFIDENCE = [95, 99] as const;

export type VaRHorizon = (typeof VAR_HORIZONS)[number];
export type VaRConfidence = (typeof VAR_CONFIDENCE)[number];
export type VaRMethod = "parametric" | "historical";

/** One-sided normal quantiles Φ^{-1}(α) for left-tail loss. */
export const VAR_Z_SCORES: Record<VaRConfidence, number> = {
  95: 1.6448536269514722,
  99: 2.3263478740408408,
};

export type VaRCell = {
  /** Positive number: loss as a fraction of portfolio (0.032 = 3.2%). */
  lossFraction: number;
  /** Signed return at the VaR cutoff (typically negative). */
  cutoffReturn: number;
};

export type VaRMatrix = Record<VaRHorizon, Record<VaRConfidence, VaRCell>>;

export type VaRHistogramBin = {
  x0: number;
  x1: number;
  mid: number;
  count: number;
  isTail: boolean;
  label: string;
};

export type VaREngineResult = {
  sampleCount: number;
  muDaily: number;
  sigmaDaily: number;
  sigmaAnnual: number;
  parametric: VaRMatrix;
  historical: VaRMatrix;
};

export function simpleReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1];
    const current = closes[index];
    if (previous == null || current == null || previous <= 0 || !Number.isFinite(current)) continue;
    out.push((current - previous) / previous);
  }
  return out;
}

export function overlappingHorizonReturns(closes: number[], horizon: number): number[] {
  if (horizon <= 1) return simpleReturns(closes);
  const out: number[] = [];
  for (let index = horizon; index < closes.length; index += 1) {
    const previous = closes[index - horizon];
    const current = closes[index];
    if (previous == null || current == null || previous <= 0 || !Number.isFinite(current)) continue;
    out.push((current - previous) / previous);
  }
  return out;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function populationStd(values: number[], average = mean(values)): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
}

export function empiricalPercentile(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const rank = (pct / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedAsc[lower]!;
  const weight = rank - lower;
  return sortedAsc[lower]! + (sortedAsc[upper]! - sortedAsc[lower]!) * weight;
}

function cellFromCutoff(cutoffReturn: number): VaRCell {
  return {
    cutoffReturn,
    lossFraction: Math.max(0, -cutoffReturn),
  };
}

function emptyMatrix(): VaRMatrix {
  return {
    1: {
      95: { lossFraction: 0, cutoffReturn: 0 },
      99: { lossFraction: 0, cutoffReturn: 0 },
    },
    10: {
      95: { lossFraction: 0, cutoffReturn: 0 },
      99: { lossFraction: 0, cutoffReturn: 0 },
    },
    30: {
      95: { lossFraction: 0, cutoffReturn: 0 },
      99: { lossFraction: 0, cutoffReturn: 0 },
    },
  };
}

function parametricCell(muDaily: number, sigmaDaily: number, horizon: VaRHorizon, confidence: VaRConfidence): VaRCell {
  const mu = muDaily * horizon;
  const sigma = sigmaDaily * Math.sqrt(horizon);
  const cutoff = mu - VAR_Z_SCORES[confidence] * sigma;
  return cellFromCutoff(cutoff);
}

function historicalCell(closes: number[], horizon: VaRHorizon, confidence: VaRConfidence): VaRCell {
  const returns = overlappingHorizonReturns(closes, horizon);
  if (returns.length < 10) return cellFromCutoff(0);
  const sorted = [...returns].sort((a, b) => a - b);
  const tailPct = 100 - confidence;
  return cellFromCutoff(empiricalPercentile(sorted, tailPct));
}

export function computeVaR(closes: number[]): VaREngineResult | null {
  const daily = simpleReturns(closes);
  if (daily.length < 30) return null;

  const muDaily = mean(daily);
  const sigmaDaily = populationStd(daily, muDaily);
  const parametric = emptyMatrix();
  const historical = emptyMatrix();

  for (const horizon of VAR_HORIZONS) {
    for (const confidence of VAR_CONFIDENCE) {
      parametric[horizon][confidence] = parametricCell(muDaily, sigmaDaily, horizon, confidence);
      historical[horizon][confidence] = historicalCell(closes, horizon, confidence);
    }
  }

  return {
    sampleCount: daily.length,
    muDaily,
    sigmaDaily,
    sigmaAnnual: sigmaDaily * Math.sqrt(252),
    parametric,
    historical,
  };
}

export function buildReturnHistogram(
  returns: number[],
  cutoffReturn: number,
  binCount = 36,
): VaRHistogramBin[] {
  if (returns.length === 0) return [];

  let min = Math.min(...returns);
  let max = Math.max(...returns);
  if (min === max) {
    min -= 0.01;
    max += 0.01;
  }

  const span = max - min;
  const width = span / binCount;
  const bins: VaRHistogramBin[] = Array.from({ length: binCount }, (_, index) => {
    const x0 = min + index * width;
    const x1 = x0 + width;
    const mid = (x0 + x1) / 2;
    return {
      x0,
      x1,
      mid,
      count: 0,
      isTail: x1 <= cutoffReturn || mid <= cutoffReturn,
      label: `${(mid * 100).toFixed(1)}%`,
    };
  });

  for (const value of returns) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / width)));
    bins[index]!.count += 1;
  }

  return bins;
}
