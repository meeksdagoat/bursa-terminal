import "server-only";

import { ICB_SECTOR_GROUPS } from "@/lib/market-hub-catalog";
import { universe } from "@/lib/universe";
import { fetchDailyCloses } from "@/lib/yahoo";
import {
  daysAgo,
  isoDate,
  momentumPct,
  pearsonCorrelation,
  scaleToScore,
  scoreFromCorrelation,
  sma,
  zScoreLatest,
} from "./math";
import { buildFactorSeries } from "./series";
import { getWeatherSeriesForRange } from "./weather";
import type { QuantFactorSignal } from "./types";
import { EXPORT_FX_SYMBOLS, PLANTATION_SYMBOLS } from "./types";

async function averageReturn(symbols: readonly string[], days: number): Promise<number | null> {
  const returns = await Promise.all(
    symbols.map(async (symbol) => {
      const closes = await fetchDailyCloses(symbol, daysAgo(days + 10)).catch(() => []);
      return momentumPct(closes, days);
    }),
  );

  const valid = returns.filter((value): value is number => value != null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

async function weatherAgriFactor(): Promise<QuantFactorSignal> {
  const endDate = isoDate(new Date());
  const startDate = isoDate(daysAgo(90));
  const weather = await getWeatherSeriesForRange(startDate, endDate);
  const precipitation = weather.series.map((row) => row.precipitationMm);
  const anomaly = zScoreLatest(precipitation);

  const plantationReturn = await averageReturn(PLANTATION_SYMBOLS, 30);
  const precipValues = weather.series.map((row) => row.precipitationMm);
  const returnSeries = await Promise.all(
    PLANTATION_SYMBOLS.map((symbol) => fetchDailyCloses(symbol, daysAgo(95)).catch(() => [])),
  );
  const avgReturns = weather.series.map((row, index) => {
    const dayReturns: number[] = [];
    for (const closes of returnSeries) {
      const pointIndex = closes.findIndex(
        (point) => new Date(point.time * 1000).toISOString().slice(0, 10) === row.date,
      );
      if (pointIndex <= 0) continue;
      const prev = closes[pointIndex - 1]?.close;
      const curr = closes[pointIndex]?.close;
      if (prev == null || curr == null || prev === 0) continue;
      dayReturns.push((curr - prev) / prev);
    }
    if (dayReturns.length === 0) return 0;
    return dayReturns.reduce((sum, value) => sum + value, 0) / dayReturns.length;
  });

  const r = pearsonCorrelation(precipValues.slice(-60), avgReturns.slice(-60));
  const droughtSignal = anomaly != null && anomaly < -0.75 ? -35 : 0;
  const score = scoreFromCorrelation(r) + droughtSignal;

  return {
    id: "weather-agri",
    label: "Weather & Agri Anomalies",
    score: Math.max(-100, Math.min(100, score)),
    confidence: weather.series.length > 45 ? 78 : 42,
    summary:
      anomaly != null && anomaly < -0.75
        ? "Plantation belt rainfall is below seasonal norms — drought stress on CPO names."
        : anomaly != null && anomaly > 0.75
          ? "Elevated rainfall across plantation regions supports yield expectations."
          : "Weather anomalies are within normal bands for plantation names.",
    targetSymbols: [...PLANTATION_SYMBOLS],
    status: weather.status,
    metadata: {
      precipitationZ: anomaly,
      plantationReturn30d: plantationReturn,
      correlationR: r,
    },
  };
}

async function institutionalDivergenceFactor(): Promise<QuantFactorSignal> {
  const flow = await buildFactorSeries("institutional_flow", 90);
  const values = [...flow.series.values()];
  const recent = values.slice(-14).reduce((sum, value) => sum + value, 0);
  const prior = values.slice(-28, -14).reduce((sum, value) => sum + value, 0);
  const filingTrend = recent - prior;

  const benchmark = await fetchDailyCloses("1155.KL", daysAgo(60)).catch(() => []);
  const momentum = momentumPct(benchmark, 30);

  const divergence =
    filingTrend > 1 && momentum != null && momentum < 0
      ? -55
      : filingTrend < -1 && momentum != null && momentum > 0
        ? 45
        : filingTrend > 0 && momentum != null && momentum > 0
          ? 35
          : 0;

  return {
    id: "institutional-divergence",
    label: "Institutional Accumulation Divergence",
    score: Math.max(-100, Math.min(100, divergence)),
    confidence: values.length > 20 ? 72 : 48,
    summary:
      divergence < -20
        ? "EPF/PNB Form 29B filings rising while price momentum fades — accumulation divergence."
        : divergence > 20
          ? "Institutional filings align with positive price momentum."
          : "Institutional flow trends are neutral versus price action.",
    targetSymbols: ["1155.KL", "1295.KL", "1023.KL"],
    status: flow.status,
    metadata: {
      filingTrend14d: filingTrend,
      momentum30d: momentum,
      recentFilings: recent,
    },
  };
}

async function newsVelocityFactor(): Promise<QuantFactorSignal> {
  const news = await buildFactorSeries("news_velocity", 30);
  const values = [...news.series.values()];
  const velocityZ = zScoreLatest(values);

  const volumeProxy = await fetchDailyCloses("1155.KL", daysAgo(40)).catch(() => []);
  const volumes = volumeProxy.map((_, index, rows) => {
    if (index === 0) return 0;
    const prev = rows[index - 1]?.close ?? 0;
    const curr = rows[index]?.close ?? 0;
    return prev === 0 ? 0 : ((curr - prev) / prev) * 100;
  });
  const volumeZ = zScoreLatest(volumes.slice(-20));

  const score =
    velocityZ != null && volumeZ != null
      ? scaleToScore((velocityZ + volumeZ) / 2, 0.8)
      : velocityZ != null
        ? scaleToScore(velocityZ, 0.7)
        : 0;

  return {
    id: "news-velocity",
    label: "Retail News & Media Velocity",
    score,
    confidence: values.length > 10 ? 68 : 40,
    summary:
      score > 25
        ? "Headline velocity is elevated — retail attention may amplify volume spikes."
        : score < -25
          ? "News flow is quiet relative to recent averages."
          : "Media velocity is in line with typical trading activity.",
    targetSymbols: ["1155.KL", "5183.KL", "3867.KL"],
    status: news.status,
    metadata: {
      headlineZ: velocityZ,
      priceMoveZ: volumeZ,
    },
  };
}

async function fxBetaFactor(): Promise<QuantFactorSignal> {
  const fx = await buildFactorSeries("usd_myr", 90);
  const fxValues = [...fx.series.values()];
  const fxReturns = fxValues.slice(1).map((value, index) => {
    const prev = fxValues[index];
    if (prev === 0) return 0;
    return (value - prev) / prev;
  });

  const exportReturn = await averageReturn(EXPORT_FX_SYMBOLS, 30);
  const stockReturns = await Promise.all(
    EXPORT_FX_SYMBOLS.map(async (symbol) => {
      const closes = await fetchDailyCloses(symbol, daysAgo(95)).catch(() => []);
      return closes;
    }),
  );

  const alignedReturns: number[] = [];
  const alignedFx: number[] = [];
  const dates = [...fx.series.keys()].sort().slice(-60);
  for (let index = 1; index < dates.length; index += 1) {
    const date = dates[index];
    const prevDate = dates[index - 1];
    const fxPrev = fx.series.get(prevDate);
    const fxCurr = fx.series.get(date);
    if (fxPrev == null || fxCurr == null || fxPrev === 0) continue;

    const dayReturns: number[] = [];
    for (const closes of stockReturns) {
      const pointIndex = closes.findIndex(
        (point) => new Date(point.time * 1000).toISOString().slice(0, 10) === date,
      );
      if (pointIndex <= 0) continue;
      const prev = closes[pointIndex - 1]?.close;
      const curr = closes[pointIndex]?.close;
      if (prev == null || curr == null || prev === 0) continue;
      dayReturns.push((curr - prev) / prev);
    }

    if (dayReturns.length === 0) continue;
    alignedFx.push((fxCurr - fxPrev) / fxPrev);
    alignedReturns.push(dayReturns.reduce((sum, value) => sum + value, 0) / dayReturns.length);
  }

  const betaR = pearsonCorrelation(alignedFx, alignedReturns);
  const score = scoreFromCorrelation(betaR);

  return {
    id: "fx-beta",
    label: "Cross-Currency FX Beta",
    score,
    confidence: alignedFx.length > 25 ? 74 : 45,
    summary:
      score > 20
        ? "Export names show positive rolling sensitivity to USD/MYR moves."
        : score < -20
          ? "Ringgit strength is correlating with export-name underperformance."
          : "FX beta for export basket is neutral over the rolling window.",
    targetSymbols: [...EXPORT_FX_SYMBOLS],
    status: fx.status,
    metadata: {
      fxBetaR: betaR,
      exportReturn30d: exportReturn,
      usdMyrLatest: fxValues.at(-1) ?? null,
    },
  };
}

async function yieldSpreadFactor(): Promise<QuantFactorSignal> {
  const bond = await buildFactorSeries("mgs_proxy", 90);
  const opr = await buildFactorSeries("bnm_opr", 90);
  const klci = await fetchDailyCloses("^KLSE", daysAgo(95)).catch(() =>
    fetchDailyCloses("1155.KL", daysAgo(95)).catch(() => []),
  );

  const klciReturns = klci.slice(1).map((point, index) => {
    const prev = klci[index]?.close;
    if (prev == null || prev === 0) return 0;
    return (point.close - prev) / prev;
  });

  const bondValues = [...bond.series.values()];
  const bondChanges = bondValues.slice(1).map((value, index) => {
    const prev = bondValues[index];
    if (prev == null || prev === 0) return 0;
    return (value - prev) / prev;
  });

  const r = pearsonCorrelation(bondChanges.slice(-60), klciReturns.slice(-60));
  const oprLevel = [...opr.series.values()].at(-1) ?? null;
  const score = scoreFromCorrelation(-(r ?? 0));

  return {
    id: "yield-spread",
    label: "Sovereign Yield Spread Sensitivity",
    score,
    confidence: bondValues.length > 25 ? 70 : 44,
    summary:
      score > 20
        ? "Equities are resilient to bond-proxy yield moves — risk-on regime."
        : score < -20
          ? "KLCI sensitivity to MGS proxy / OPR backdrop is elevated."
          : "Yield-equity correlation is balanced in the current window.",
    targetSymbols: ["1155.KL", "0820EA.KL", "0800EA.KL"],
    status: bond.status,
    metadata: {
      bondEquityR: r,
      oprLevel,
      bondProxyLatest: bondValues.at(-1) ?? null,
    },
  };
}

async function sectorBreadthFactor(): Promise<QuantFactorSignal> {
  const sectors = ICB_SECTOR_GROUPS.slice(0, 6);
  const breadths: Array<{ label: string; pct: number }> = [];

  for (const group of sectors) {
    const symbols = universe
      .filter((entry) => group.sectors.includes(entry.sector))
      .slice(0, 10)
      .map((entry) => entry.symbol);

    let above = 0;
    let total = 0;

    for (const symbol of symbols) {
      const closes = await fetchDailyCloses(symbol, daysAgo(45)).catch(() => []);
      if (closes.length < 21) continue;
      const window = closes.slice(-21).map((row) => row.close);
      const average = sma(window, 20);
      const latest = closes.at(-1)?.close;
      if (average == null || latest == null) continue;
      total += 1;
      if (latest >= average) above += 1;
    }

    if (total > 0) breadths.push({ label: group.label, pct: (above / total) * 100 });
  }

  const averageBreadth =
    breadths.length > 0
      ? breadths.reduce((sum, row) => sum + row.pct, 0) / breadths.length
      : 50;

  const score = scaleToScore((averageBreadth - 50) / 25, 1);

  const weakest = [...breadths].sort((left, right) => left.pct - right.pct)[0];
  const strongest = [...breadths].sort((left, right) => right.pct - left.pct)[0];

  return {
    id: "sector-breadth",
    label: "Sector Market Breadth",
    score,
    confidence: breadths.length >= 4 ? 76 : 50,
    summary:
      averageBreadth > 60
        ? `Broad participation — ${strongest?.label ?? "Leaders"} leading above 20-day MAs.`
        : averageBreadth < 40
          ? `Narrow market — ${weakest?.label ?? "Laggards"} lagging 20-day MAs.`
          : "Sector breadth is mixed around the 20-day moving average.",
    targetSymbols: breadths.length > 0 ? ["1155.KL"] : ["1155.KL"],
    status: breadths.length > 0 ? "live" : "fallback",
    metadata: {
      averageBreadth,
      strongestSector: strongest?.label ?? null,
      strongestPct: strongest?.pct ?? null,
      weakestSector: weakest?.label ?? null,
      weakestPct: weakest?.pct ?? null,
    },
  };
}

export async function computeQuantFactors(): Promise<{
  factors: QuantFactorSignal[];
  errors: string[];
}> {
  const results = await Promise.allSettled([
    weatherAgriFactor(),
    institutionalDivergenceFactor(),
    newsVelocityFactor(),
    fxBetaFactor(),
    yieldSpreadFactor(),
    sectorBreadthFactor(),
  ]);

  const factors: QuantFactorSignal[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      factors.push(result.value);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  return { factors, errors };
}
