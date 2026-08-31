import "server-only";

import { getAnnouncementsFeed } from "@/lib/announcements";
import { getCompanyNews } from "@/lib/company-news";
import { INSTITUTION_PATTERNS } from "@/lib/market-hub-catalog";
import { entryBySymbol } from "@/lib/universe";
import type { UniverseEntry } from "@/lib/types";
import { fetchDailyCloses } from "@/lib/yahoo";
import { buildCorrelationPayload } from "./correlation";
import {
  daysAgo,
  klIsoDate,
  lastNDates,
  momentumPct,
  pctAboveMovingAverage,
  scaleToScore,
  scoreFromCorrelation,
  zScoreLatest,
} from "./math";
import { assessOverviewFactorRelevance } from "./sector-relevance";
import { buildFactorSeries } from "./series";
import { getWeatherSeriesForRange } from "./weather";
import type { QuantFactorId, QuantFactorSignal, SymbolFactorsPayload } from "./types";

function countByDate(items: Array<{ publishedAt: string | null }>, days: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of lastNDates(days)) counts.set(date, 0);

  for (const item of items) {
    if (!item.publishedAt) continue;
    const date = item.publishedAt.slice(0, 10);
    if (!counts.has(date)) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return counts;
}

function detectInstitution(title: string): boolean {
  return INSTITUTION_PATTERNS.some((entry) => entry.pattern.test(title));
}

function clampScore(score: number): number {
  return Math.max(-100, Math.min(100, score));
}

function mutedSignal(
  id: QuantFactorId,
  label: string,
  sector: string,
  factorCategory: string,
  status: QuantFactorSignal["status"] = "live",
): QuantFactorSignal {
  return {
    id,
    label,
    score: 0,
    confidence: 28,
    summary: `Neutral — ${sector} has low relevance to ${factorCategory} for this target.`,
    targetSymbols: [],
    status,
    metadata: { sectorMuted: sector },
  };
}

async function weatherAgriForSymbol(entry: UniverseEntry): Promise<QuantFactorSignal> {
  const relevance = assessOverviewFactorRelevance("weather-agri", entry.sector);
  if (relevance.level === "low") {
    return mutedSignal("weather-agri", "Weather & Agri Anomalies", entry.sector, "Weather");
  }

  const endDate = klIsoDate();
  const startDate = klIsoDate(daysAgo(90));
  const [weather, correlation] = await Promise.all([
    getWeatherSeriesForRange(startDate, endDate),
    buildCorrelationPayload("rainfall", entry.symbol, 90),
  ]);

  const precipitation = weather.series.map((row) => row.precipitationMm);
  const anomaly = zScoreLatest(precipitation);
  const r = correlation.metrics.pearsonR90 ?? correlation.metrics.pearsonR60 ?? correlation.metrics.pearsonR30;
  const droughtSignal = anomaly != null && anomaly < -0.75 ? -35 : 0;
  const score = clampScore(scoreFromCorrelation(r) + droughtSignal);

  return {
    id: "weather-agri",
    label: "Weather & Agri Anomalies",
    score,
    confidence: correlation.metrics.alignedTradingDays > 45 ? 78 : 42,
    summary:
      anomaly != null && anomaly < -0.75
        ? `${entry.shortName}: plantation-belt rainfall below norms — drought stress signal.`
        : anomaly != null && anomaly > 0.75
          ? `${entry.shortName}: elevated rainfall supports yield expectations.`
          : `${entry.shortName}: weather anomalies within normal bands; r₉₀=${r?.toFixed(2) ?? "—"}.`,
    targetSymbols: [entry.symbol],
    status: weather.status,
    metadata: {
      precipitationZ: anomaly,
      correlationR90: r,
      pearsonR30: correlation.metrics.pearsonR30,
      pearsonR90: correlation.metrics.pearsonR90,
    },
  };
}

async function institutionalDivergenceForSymbol(entry: UniverseEntry): Promise<QuantFactorSignal> {
  const relevance = assessOverviewFactorRelevance("institutional-divergence", entry.sector);
  if (relevance.level === "low") {
    return mutedSignal(
      "institutional-divergence",
      "Institutional Accumulation Divergence",
      entry.sector,
      "Institutional Flow",
    );
  }

  const feed = await getAnnouncementsFeed();
  const items = (feed.items ?? []).filter((item) => {
    if (item.symbol !== entry.symbol && item.code !== entry.code) return false;
    const hay = `${item.title} ${item.filingType ?? ""}`;
    return (
      /29\s*b|substantial shareholder|shareholding change|notice of interest|notice of change/i.test(
        hay,
      ) && detectInstitution(hay)
    );
  });

  const counts = countByDate(items, 90);
  const values = [...counts.values()];
  const recent = values.slice(-14).reduce((sum, value) => sum + value, 0);
  const prior = values.slice(-28, -14).reduce((sum, value) => sum + value, 0);
  const filingTrend = recent - prior;

  const closes = await fetchDailyCloses(entry.symbol, daysAgo(60)).catch(() => []);
  const momentum = momentumPct(closes, 30);

  const divergence =
    filingTrend > 0 && momentum != null && momentum < 0
      ? -55
      : filingTrend < 0 && momentum != null && momentum > 0
        ? 45
        : filingTrend > 0 && momentum != null && momentum > 0
          ? 35
          : 0;

  return {
    id: "institutional-divergence",
    label: "Institutional Accumulation Divergence",
    score: clampScore(divergence),
    confidence: values.length > 20 ? 72 : 48,
    summary:
      divergence < -20
        ? `${entry.shortName}: institutional filings rising while price momentum fades.`
        : divergence > 20
          ? `${entry.shortName}: institutional filings align with positive momentum.`
          : `${entry.shortName}: institutional flow trends neutral versus price action.`,
    targetSymbols: [entry.symbol],
    status: items.length > 0 ? "live" : "degraded",
    metadata: {
      filingTrend14d: filingTrend,
      momentum30d: momentum,
      recentFilings: recent,
    },
  };
}

async function newsVelocityForSymbol(entry: UniverseEntry): Promise<QuantFactorSignal> {
  const news = await getCompanyNews(entry);
  const counts = countByDate(news.items, 30);
  const values = [...counts.values()];
  const velocityZ = zScoreLatest(values);

  const closes = await fetchDailyCloses(entry.symbol, daysAgo(40)).catch(() => []);
  const priceMoves = closes.slice(1).map((point, index) => {
    const prev = closes[index]?.close ?? 0;
    const curr = point.close;
    return prev === 0 ? 0 : ((curr - prev) / prev) * 100;
  });
  const volumeZ = zScoreLatest(priceMoves.slice(-20));

  const score =
    velocityZ != null && volumeZ != null
      ? scaleToScore((velocityZ + volumeZ) / 2, 0.8)
      : velocityZ != null
        ? scaleToScore(velocityZ, 0.7)
        : 0;

  return {
    id: "news-velocity",
    label: "Retail News & Media Velocity",
    score: clampScore(score),
    confidence: values.length > 10 ? 68 : 40,
    summary:
      score > 25
        ? `${entry.shortName}: headline velocity elevated — retail attention may amplify moves.`
        : score < -25
          ? `${entry.shortName}: news flow quiet relative to recent averages.`
          : `${entry.shortName}: media velocity in line with typical activity.`,
    targetSymbols: [entry.symbol],
    status: news.items.length > 0 ? "live" : "degraded",
    metadata: {
      headlineZ: velocityZ,
      priceMoveZ: volumeZ,
      headlineCount14d: values.slice(-14).reduce((sum, value) => sum + value, 0),
    },
  };
}

async function fxBetaForSymbol(entry: UniverseEntry): Promise<QuantFactorSignal> {
  const relevance = assessOverviewFactorRelevance("fx-beta", entry.sector);
  if (relevance.level === "low") {
    return mutedSignal("fx-beta", "Cross-Currency FX Beta", entry.sector, "FX Export Beta");
  }

  const correlation = await buildCorrelationPayload("usd_myr", entry.symbol, 90);
  const r30 = correlation.metrics.pearsonR30;
  const r90 = correlation.metrics.pearsonR90 ?? correlation.metrics.pearsonR60 ?? r30;
  const blended = r30 != null && r90 != null ? (r30 + r90) / 2 : (r90 ?? r30);
  const score = clampScore(scoreFromCorrelation(blended));

  return {
    id: "fx-beta",
    label: "Cross-Currency FX Beta",
    score,
    confidence: correlation.metrics.alignedTradingDays > 25 ? 74 : 45,
    summary:
      score > 20
        ? `${entry.shortName}: positive rolling beta to USD/MYR (30D r=${r30?.toFixed(2) ?? "—"}, 90D r=${r90?.toFixed(2) ?? "—"}).`
        : score < -20
          ? `${entry.shortName}: Ringgit strength correlates with underperformance.`
          : `${entry.shortName}: FX beta neutral over rolling 30D/90D windows.`,
    targetSymbols: [entry.symbol],
    status: correlation.status,
    metadata: {
      fxBetaR30: r30,
      fxBetaR90: r90,
      alignedDays: correlation.metrics.alignedTradingDays,
    },
  };
}

async function yieldSpreadForSymbol(entry: UniverseEntry): Promise<QuantFactorSignal> {
  const relevance = assessOverviewFactorRelevance("yield-spread", entry.sector);
  if (relevance.level === "low") {
    return mutedSignal(
      "yield-spread",
      "Sovereign Yield Spread Sensitivity",
      entry.sector,
      "Yield Sensitivity",
    );
  }

  const [bondCorrelation, oprCorrelation] = await Promise.all([
    buildCorrelationPayload("mgs_proxy", entry.symbol, 90),
    buildCorrelationPayload("bnm_opr", entry.symbol, 90),
  ]);

  const bondR = bondCorrelation.metrics.pearsonR90 ?? bondCorrelation.metrics.pearsonR60;
  const oprR = oprCorrelation.metrics.pearsonR90 ?? oprCorrelation.metrics.pearsonR60;
  const blended = bondR != null && oprR != null ? (bondR + oprR) / 2 : (bondR ?? oprR);
  const score = clampScore(scoreFromCorrelation(-(blended ?? 0)));

  return {
    id: "yield-spread",
    label: "Sovereign Yield Spread Sensitivity",
    score,
    confidence:
      bondCorrelation.metrics.alignedTradingDays > 25 ? 70 : 44,
    summary:
      score > 20
        ? `${entry.shortName}: resilient to MGS proxy / OPR moves — risk-on.`
        : score < -20
          ? `${entry.shortName}: elevated sensitivity to sovereign yield backdrop.`
          : `${entry.shortName}: yield-equity correlation balanced (MGS r=${bondR?.toFixed(2) ?? "—"}).`,
    targetSymbols: [entry.symbol],
    status: bondCorrelation.status,
    metadata: {
      bondEquityR90: bondR,
      oprEquityR90: oprR,
      alignedDays: bondCorrelation.metrics.alignedTradingDays,
    },
  };
}

async function sectorBreadthForSymbol(entry: UniverseEntry): Promise<QuantFactorSignal> {
  const breadth = await buildFactorSeries("sector_breadth", 90, entry.symbol);
  const values = [...breadth.series.values()];
  const latest = values.at(-1) ?? 50;
  const score = clampScore(scaleToScore((latest - 50) / 25, 1));

  const closes = await fetchDailyCloses(entry.symbol, daysAgo(45)).catch(() => []);
  const aboveMa = pctAboveMovingAverage(closes, 20);

  return {
    id: "sector-breadth",
    label: "Sector Market Breadth",
    score,
    confidence: values.length >= 4 ? 76 : 50,
    summary:
      latest > 60
        ? `${entry.sector}: broad participation — ${Math.round(latest)}% of sector above 20D MA.`
        : latest < 40
          ? `${entry.sector}: narrow market — only ${Math.round(latest)}% above 20D MA.`
          : `${entry.sector}: mixed breadth around the 20-day moving average.`,
    targetSymbols: [entry.symbol],
    status: breadth.status,
    metadata: {
      sectorBreadthPct: latest,
      targetAboveMa20: aboveMa,
      sector: entry.sector,
    },
  };
}

export async function computeQuantFactorsForSymbol(symbol: string): Promise<SymbolFactorsPayload> {
  const entry = entryBySymbol(symbol);
  if (!entry) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  const results = await Promise.allSettled([
    weatherAgriForSymbol(entry),
    institutionalDivergenceForSymbol(entry),
    newsVelocityForSymbol(entry),
    fxBetaForSymbol(entry),
    yieldSpreadForSymbol(entry),
    sectorBreadthForSymbol(entry),
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

  return {
    asOf: new Date().toISOString(),
    symbol: entry.symbol,
    symbolLabel: entry.shortName,
    targetSector: entry.sector,
    factors,
    errors,
  };
}
