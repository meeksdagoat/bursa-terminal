/** Client-safe Markowitz mean-variance portfolio simulation. */

import { resolveQuantAsset, type QuantAssetCurrency } from "@/lib/quant/asset-catalog";
import { normalizeTradingDate, unixToDate } from "@/lib/quant/math";
import type { DailyClose } from "@/lib/types";

export const USD_MYR_FX_SYMBOL = "USDMYR=X";

export type FrontierBaseCurrency = "MYR" | "USD";

export const DEFAULT_FRONTIER_SYMBOLS = [
  "1155.KL",
  "1295.KL",
  "NVDA",
  "GC=F",
] as const;
export const MIN_FRONTIER_SYMBOLS = 3;
export const MAX_FRONTIER_SYMBOLS = 10;
export const FRONTIER_SIMULATION_COUNT = 2500;
export const TRADING_DAYS_PER_YEAR = 252;

export const FRONTIER_PORTFOLIO_PRESETS = [
  {
    id: "my_big4_banks",
    label: "MY Big 4 Banks",
    symbols: ["1155.KL", "1295.KL", "1023.KL", "1066.KL"],
  },
  {
    id: "bursa_blue_chips",
    label: "Bursa Blue Chips",
    symbols: ["1155.KL", "1295.KL", "5347.KL", "3182.KL", "5183.KL", "6012.KL"],
  },
  {
    id: "us_mega_cap",
    label: "US Mega Cap Tech",
    symbols: ["AAPL", "NVDA", "MSFT", "AMZN", "META", "GOOGL"],
  },
  {
    id: "cross_asset_macro",
    label: "Cross-Asset Macro",
    symbols: ["1155.KL", "QQQ", "GC=F", "BZ=F", "USDMYR=X"],
  },
  {
    id: "my_banks_us_tech_gold",
    label: "MY Banks + US Tech + Gold",
    symbols: ["1155.KL", "1295.KL", "NVDA", "AAPL", "GC=F"],
  },
] as const;

export type FrontierPresetId = (typeof FRONTIER_PORTFOLIO_PRESETS)[number]["id"];
export type PortfolioPoint = {
  id: number;
  weights: number[];
  expectedReturn: number;
  risk: number;
  sharpe: number;
};

export type FrontierResult = {
  points: PortfolioPoint[];
  maxSharpe: PortfolioPoint;
  minVariance: PortfolioPoint;
  symbols: string[];
  meanReturns: number[];
  covariance: number[][];
  alignedDays: number;
  baseCurrency: FrontierBaseCurrency;
};

type ReturnMatrix = {
  symbols: string[];
  dates: string[];
  returns: number[][];
  alignedDays: number;
  baseCurrency: FrontierBaseCurrency;
};

export type AlignReturnMatrixOptions = {
  baseCurrency?: FrontierBaseCurrency;
  fxSeries?: Map<string, number>;
};

function closesToMap(points: DailyClose[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) {
    if (!Number.isFinite(point.close) || point.close <= 0) continue;
    map.set(normalizeTradingDate(unixToDate(point.time)), point.close);
  }
  return map;
}

export function resolveSymbolCurrency(symbol: string): QuantAssetCurrency {
  const asset = resolveQuantAsset(symbol);
  if (asset) return asset.currency;
  if (symbol.endsWith(".KL")) return "MYR";
  if (symbol === "^KLSE") return "POINTS";
  return "USD";
}

export function portfolioNeedsFxConversion(
  symbols: string[],
  baseCurrency: FrontierBaseCurrency,
): boolean {
  return symbols.some((symbol) => resolveSymbolCurrency(symbol) !== baseCurrency);
}

function forwardFillSeries(dates: string[], series: Map<string, number>, fallback: number): number[] {
  let last = fallback;
  return dates.map((date) => {
    if (series.has(date)) last = series.get(date)!;
    return last;
  });
}

function convertToBaseCurrency(
  price: number,
  assetCurrency: QuantAssetCurrency,
  baseCurrency: FrontierBaseCurrency,
  usdMyrRate: number,
): number {
  if (assetCurrency === baseCurrency || assetCurrency === "POINTS") return price;
  if (baseCurrency === "MYR" && assetCurrency === "USD") return price * usdMyrRate;
  if (baseCurrency === "USD" && assetCurrency === "MYR") {
    return usdMyrRate > 0 ? price / usdMyrRate : price;
  }
  return price;
}

function logReturn(prev: number, curr: number): number {
  if (prev <= 0 || curr <= 0) return 0;
  return Math.log(curr / prev);
}

export function alignReturnMatrix(
  seriesBySymbol: Record<string, DailyClose[]>,
  options: AlignReturnMatrixOptions = {},
): ReturnMatrix | null {
  const baseCurrency = options.baseCurrency ?? "MYR";
  const symbols = Object.keys(seriesBySymbol);
  if (symbols.length < MIN_FRONTIER_SYMBOLS) return null;

  const maps = symbols.map((symbol) => closesToMap(seriesBySymbol[symbol] ?? []));
  let dates = [...maps[0]!.keys()];
  for (const map of maps.slice(1)) {
    dates = dates.filter((date) => map.has(date));
  }
  dates.sort();
  if (dates.length < 61) return null;

  const needsFx = portfolioNeedsFxConversion(symbols, baseCurrency);
  const fxMap = options.fxSeries ?? new Map<string, number>();
  const fxFallback =
    [...fxMap.values()].at(-1) ??
    (baseCurrency === "MYR" ? 4.45 : 1);
  const fxRates = needsFx ? forwardFillSeries(dates, fxMap, fxFallback) : [];

  const returns: number[][] = symbols.map((symbol, symbolIndex) => {
    const map = maps[symbolIndex]!;
    const assetCurrency = resolveSymbolCurrency(symbol);
    const dailyReturns: number[] = [];

    for (let index = 1; index < dates.length; index += 1) {
      const prevRaw = map.get(dates[index - 1]!);
      const currRaw = map.get(dates[index]!);
      if (prevRaw == null || currRaw == null) {
        dailyReturns.push(0);
        continue;
      }

      const fxPrev = needsFx ? fxRates[index - 1]! : 1;
      const fxCurr = needsFx ? fxRates[index]! : 1;
      const prev = convertToBaseCurrency(prevRaw, assetCurrency, baseCurrency, fxPrev);
      const curr = convertToBaseCurrency(currRaw, assetCurrency, baseCurrency, fxCurr);
      dailyReturns.push(logReturn(prev, curr));
    }

    return dailyReturns;
  });

  return {
    symbols,
    dates: dates.slice(1),
    returns,
    alignedDays: dates.length - 1,
    baseCurrency,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function covarianceMatrix(returns: number[][]): number[][] {
  const n = returns.length;
  const length = returns[0]?.length ?? 0;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const xs = returns[i]!;
      const ys = returns[j]!;
      const meanX = mean(xs);
      const meanY = mean(ys);
      let cov = 0;
      for (let index = 0; index < length; index += 1) {
        cov += (xs[index]! - meanX) * (ys[index]! - meanY);
      }
      cov /= Math.max(1, length - 1);
      matrix[i]![j] = cov * TRADING_DAYS_PER_YEAR;
      matrix[j]![i] = cov * TRADING_DAYS_PER_YEAR;
    }
  }

  return matrix;
}

function portfolioStats(
  weights: number[],
  meanReturns: number[],
  covariance: number[][],
  riskFreeRate = 0.03,
): { expectedReturn: number; risk: number; sharpe: number } {
  const expectedReturn = weights.reduce(
    (sum, weight, index) => sum + weight * (meanReturns[index] ?? 0),
    0,
  );

  let variance = 0;
  for (let i = 0; i < weights.length; i += 1) {
    for (let j = 0; j < weights.length; j += 1) {
      variance += (weights[i] ?? 0) * (weights[j] ?? 0) * (covariance[i]?.[j] ?? 0);
    }
  }

  const risk = Math.sqrt(Math.max(variance, 0));
  const sharpe = risk > 0 ? (expectedReturn - riskFreeRate) / risk : 0;

  return { expectedReturn, risk, sharpe };
}

function randomWeights(count: number): number[] {
  const raw = Array.from({ length: count }, () => Math.random());
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

export function simulateEfficientFrontier(
  matrix: ReturnMatrix,
  simulations = FRONTIER_SIMULATION_COUNT,
): FrontierResult {
  const meanReturns = matrix.returns.map((series) => mean(series) * TRADING_DAYS_PER_YEAR);
  const covariance = covarianceMatrix(matrix.returns);

  const points: PortfolioPoint[] = Array.from({ length: simulations }, (_, id) => {
    const weights = randomWeights(matrix.symbols.length);
    const stats = portfolioStats(weights, meanReturns, covariance);
    return { id, weights, ...stats };
  });

  const maxSharpe = points.reduce((best, point) =>
    point.sharpe > best.sharpe ? point : best,
  );
  const minVariance = points.reduce((best, point) =>
    point.risk < best.risk ? point : best,
  );

  return {
    points,
    maxSharpe,
    minVariance,
    symbols: matrix.symbols,
    meanReturns,
    covariance,
    alignedDays: matrix.alignedDays,
    baseCurrency: matrix.baseCurrency,
  };
}

/** Pareto-optimal upper envelope: max return for each increasing risk level. */
export function upperEfficientFrontier(points: PortfolioPoint[]): PortfolioPoint[] {
  const sorted = [...points].sort((left, right) => left.risk - right.risk);
  const envelope: PortfolioPoint[] = [];
  let maxReturn = -Infinity;

  for (const point of sorted) {
    if (point.expectedReturn > maxReturn) {
      envelope.push(point);
      maxReturn = point.expectedReturn;
    }
  }

  return envelope.length > 0 ? envelope : sorted;
}

function interpolatePortfolioPoint(
  left: PortfolioPoint,
  right: PortfolioPoint,
  fraction: number,
  meanReturns: number[],
  covariance: number[][],
): PortfolioPoint {
  const t = Math.min(1, Math.max(0, fraction));
  const weights = left.weights.map(
    (weight, index) => weight * (1 - t) + (right.weights[index] ?? 0) * t,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const normalized = total > 0 ? weights.map((weight) => weight / total) : weights;
  const stats = portfolioStats(normalized, meanReturns, covariance);

  return {
    id: -1,
    weights: normalized,
    ...stats,
  };
}

/** Map slider tolerance (0–1) to a point on the simulated upper efficient frontier. */
export function portfolioForRiskTolerance(
  frontier: FrontierResult,
  tolerance: number,
): PortfolioPoint {
  const envelope = upperEfficientFrontier(frontier.points);
  if (envelope.length === 1) return envelope[0]!;

  const clamped = Math.min(1, Math.max(0, tolerance));
  const scaledIndex = clamped * (envelope.length - 1);
  const lowerIndex = Math.floor(scaledIndex);
  const upperIndex = Math.ceil(scaledIndex);

  if (lowerIndex === upperIndex) {
    return envelope[lowerIndex]!;
  }

  const fraction = scaledIndex - lowerIndex;
  return interpolatePortfolioPoint(
    envelope[lowerIndex]!,
    envelope[upperIndex]!,
    fraction,
    frontier.meanReturns,
    frontier.covariance,
  );
}

export function formatWeightPct(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}
