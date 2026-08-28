/** Client-safe Geometric Brownian Motion Monte Carlo utilities. */

export const TRADING_DAYS_PER_YEAR = 252;
export const DELTA_T = 1 / TRADING_DAYS_PER_YEAR;
export const SAMPLE_PATH_COUNT = 35;
/** Maximum background paths drawn on the chart regardless of run count. */
export const MAX_CHART_SAMPLE_PATHS = 40;
export const MAX_HORIZON_DAYS = 365;

export const MONTE_CARLO_HORIZON_OPTIONS = [
  { label: "30D", days: 30 },
  { label: "60D", days: 60 },
  { label: "90D", days: 90 },
  { label: "180D", days: 180 },
  { label: "1Y", days: 365 },
] as const;

export const MONTE_CARLO_HORIZONS = MONTE_CARLO_HORIZON_OPTIONS.map((option) => option.days);
export const MONTE_CARLO_RUN_OPTIONS = [250, 500, 1000, 5000, 10000] as const;

export type MonteCarloHorizon = (typeof MONTE_CARLO_HORIZONS)[number];
export type MonteCarloRunCount = (typeof MONTE_CARLO_RUN_OPTIONS)[number];

export type GbmParameters = {
  /** Daily log-return drift μ */
  muDaily: number;
  /** Daily log-return volatility σ */
  sigmaDaily: number;
};

export type MonteCarloTerminalStats = {
  meanPrice: number;
  medianPrice: number;
  p10Price: number;
  p90Price: number;
  p5Price: number;
  profitProbability: number;
  /** 95% VaR vs S₀: ((P₅ − S₀) / S₀) × 100 */
  var95Pct: number;
  meanReturnPct: number;
};

export type MonteCarloSimulationResult = {
  horizonDays: number;
  horizonLabel: string;
  chartDownsampleStep: number;
  priceCap: number;
  priceFloor: number;
  chartYDomain: [number, number];
  paths: number[][];
  samplePathIndices: number[];
  percentilePaths: {
    p10: number[];
    p50: number[];
    p90: number[];
  };
  terminalPrices: number[];
  stats: MonteCarloTerminalStats;
  chartRows: MonteCarloChartRow[];
};

export type MonteCarloChartRow = {
  day: number;
  label: string;
  p10: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
  [sampleKey: string]: number | string;
};

/** Box-Muller transform: Z ~ N(0, 1). */
export function boxMullerNormal(): number {
  let u1 = 0;
  while (u1 === 0) u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function percentile(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;

  const rank = (pct / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedAsc[lower]!;

  const weight = rank - lower;
  return sortedAsc[lower]! + (sortedAsc[upper]! - sortedAsc[lower]!) * weight;
}

export function horizonLabelForDays(days: number): string {
  return MONTE_CARLO_HORIZON_OPTIONS.find((option) => option.days === days)?.label ?? `${days}D`;
}

export function chartDownsampleStep(_horizonDays: number): number {
  return 1;
}

export function chartPointLabel(day: number): string {
  if (day === 0) return "Now";
  return `+${day}d`;
}

/** 95% VaR relative to starting price S₀. */
export function computeVar95Pct(startPrice: number, p5Price: number): number {
  if (startPrice <= 0) return 0;
  return ((p5Price - startPrice) / startPrice) * 100;
}

/** Estimate daily GBM μ and σ from an ascending close-price series. */
export function estimateGbmParameters(closes: number[]): GbmParameters | null {
  const logReturns: number[] = [];

  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1];
    const current = closes[index];
    if (previous == null || current == null || previous <= 0 || current <= 0) continue;
    logReturns.push(Math.log(current / previous));
  }

  if (logReturns.length < 10) return null;

  const n = logReturns.length;
  const muDaily = logReturns.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    logReturns.reduce((sum, value) => sum + (value - muDaily) ** 2, 0) / Math.max(1, n - 1);
  const sigmaDaily = Math.sqrt(variance);

  return {
    muDaily,
    sigmaDaily: sigmaDaily > 0 ? sigmaDaily : 0.0001,
  };
}

export function annualizeMu(muDaily: number): number {
  return muDaily * TRADING_DAYS_PER_YEAR;
}

export function annualizeSigma(sigmaDaily: number): number {
  return sigmaDaily * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

function toAnnualGbmParams(muDaily: number, sigmaDaily: number): { muAnnual: number; sigmaAnnual: number } {
  return {
    muAnnual: annualizeMu(muDaily),
    sigmaAnnual: annualizeSigma(sigmaDaily),
  };
}

function priceBounds(
  startPrice: number,
  horizonDays: number,
  sigmaAnnual: number,
): { floor: number; cap: number } {
  const years = horizonDays / TRADING_DAYS_PER_YEAR;
  const logBand = sigmaAnnual * Math.sqrt(Math.max(years, 1 / TRADING_DAYS_PER_YEAR)) * 2.5 + Math.log(1 + years * 0.15);
  return {
    floor: startPrice * Math.exp(-logBand),
    cap: startPrice * Math.exp(logBand),
  };
}

function clampPrice(price: number, floor: number, cap: number): number {
  return Math.min(Math.max(price, floor), cap);
}

export function chartYDomain(rows: MonteCarloChartRow[], startPrice: number): [number, number] {
  if (rows.length === 0) return [startPrice * 0.9, startPrice * 1.1];

  const lows = rows.map((row) => row.p10);
  const highs = rows.map((row) => row.p90);
  const yMin = Math.min(startPrice, ...lows) * 0.97;
  const yMax = Math.max(startPrice, ...highs) * 1.03;
  return [yMin, yMax];
}

/**
 * Single GBM path with Δt = 1/252:
 * S_t = S_{t-1} * exp((μ - 0.5σ²)Δt + σ√Δt·Z)
 */
export function simulateGbmPath(
  startPrice: number,
  muDaily: number,
  sigmaDaily: number,
  horizonDays: number,
): number[] {
  const { muAnnual, sigmaAnnual } = toAnnualGbmParams(muDaily, sigmaDaily);
  const bounds = priceBounds(startPrice, horizonDays, sigmaAnnual);
  const drift = (muAnnual - 0.5 * sigmaAnnual * sigmaAnnual) * DELTA_T;
  const shockScale = sigmaAnnual * Math.sqrt(DELTA_T);
  const path = [startPrice];

  for (let day = 0; day < horizonDays; day += 1) {
    const rawNext = path[path.length - 1]! * Math.exp(drift + shockScale * boxMullerNormal());
    path.push(clampPrice(rawNext, bounds.floor, bounds.cap));
  }

  return path;
}

function pickSampleIndices(totalRuns: number, sampleCount: number): number[] {
  const count = Math.min(sampleCount, totalRuns, MAX_CHART_SAMPLE_PATHS);
  if (count <= 0) return [];
  if (count >= totalRuns) {
    return Array.from({ length: totalRuns }, (_, index) => index);
  }

  const stride = totalRuns / count;
  return Array.from({ length: count }, (_, index) =>
    Math.min(totalRuns - 1, Math.floor(index * stride + stride * 0.5)),
  );
}

export function runMonteCarloSimulation(input: {
  startPrice: number;
  muDaily: number;
  sigmaDaily: number;
  horizonDays: number;
  runs: number;
  sampleCount?: number;
}): MonteCarloSimulationResult {
  const { startPrice, muDaily, sigmaDaily, runs } = input;
  const horizonDays = Math.min(MAX_HORIZON_DAYS, Math.max(1, input.horizonDays));
  const sampleCount = Math.min(
    input.sampleCount ?? SAMPLE_PATH_COUNT,
    MAX_CHART_SAMPLE_PATHS,
  );
  const chartStep = chartDownsampleStep(horizonDays);
  const horizonLabel = horizonLabelForDays(horizonDays);
  const { sigmaAnnual } = toAnnualGbmParams(muDaily, sigmaDaily);
  const bounds = priceBounds(startPrice, horizonDays, sigmaAnnual);

  const paths = Array.from({ length: runs }, () =>
    simulateGbmPath(startPrice, muDaily, sigmaDaily, horizonDays),
  );

  const terminalPrices = paths.map((path) => path[path.length - 1] ?? startPrice);
  const sortedTerminal = [...terminalPrices].sort((left, right) => left - right);

  const meanPrice = terminalPrices.reduce((sum, value) => sum + value, 0) / runs;
  const medianPrice = percentile(sortedTerminal, 50);
  const p10Price = percentile(sortedTerminal, 10);
  const p90Price = percentile(sortedTerminal, 90);
  const p5Price = percentile(sortedTerminal, 5);
  const profitProbability =
    (terminalPrices.filter((price) => price > startPrice).length / runs) * 100;
  const var95Pct = computeVar95Pct(startPrice, p5Price);
  const meanReturnPct = ((meanPrice - startPrice) / startPrice) * 100;

  const percentilePaths = {
    p10: [] as number[],
    p50: [] as number[],
    p90: [] as number[],
  };

  const chartRows: MonteCarloChartRow[] = [];
  const samplePathIndices = pickSampleIndices(runs, sampleCount);

  for (let day = 0; day <= horizonDays; day += chartStep) {
    const dayPrices = paths.map((path) => path[day] ?? startPrice).sort((a, b) => a - b);
    const row: MonteCarloChartRow = {
      day,
      label: chartPointLabel(day),
      p10: percentile(dayPrices, 10),
      p50: percentile(dayPrices, 50),
      p90: percentile(dayPrices, 90),
      min: dayPrices[0] ?? startPrice,
      max: dayPrices[dayPrices.length - 1] ?? startPrice,
    };

    percentilePaths.p10.push(row.p10);
    percentilePaths.p50.push(row.p50);
    percentilePaths.p90.push(row.p90);

    for (const index of samplePathIndices) {
      row[`sample_${index}`] = paths[index]![day] ?? startPrice;
    }

    chartRows.push(row);
  }

  if (chartRows.at(-1)?.day !== horizonDays) {
    const day = horizonDays;
    const dayPrices = paths.map((path) => path[day] ?? startPrice).sort((a, b) => a - b);
    const row: MonteCarloChartRow = {
      day,
      label: chartPointLabel(day),
      p10: percentile(dayPrices, 10),
      p50: percentile(dayPrices, 50),
      p90: percentile(dayPrices, 90),
      min: dayPrices[0] ?? startPrice,
      max: dayPrices[dayPrices.length - 1] ?? startPrice,
    };
    for (const index of samplePathIndices) {
      row[`sample_${index}`] = paths[index]![day] ?? startPrice;
    }
    chartRows.push(row);
  }

  return {
    horizonDays,
    horizonLabel,
    chartDownsampleStep: chartStep,
    priceCap: bounds.cap,
    priceFloor: bounds.floor,
    chartYDomain: chartYDomain(chartRows, startPrice),
    paths,
    samplePathIndices,
    percentilePaths,
    terminalPrices,
    chartRows,
    stats: {
      meanPrice,
      medianPrice,
      p10Price,
      p90Price,
      p5Price,
      profitProbability,
      var95Pct,
      meanReturnPct,
    },
  };
}
