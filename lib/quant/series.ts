import "server-only";

import { getAnnouncementsFeed } from "@/lib/announcements";
import { getBnmSnapshot } from "@/lib/bnm";
import { INSTITUTION_PATTERNS } from "@/lib/market-hub-catalog";
import { fetchRss, googleNewsUrl } from "@/lib/rss";
import { NEWS_WINDOW_DAYS } from "@/lib/news-window";
import { entryBySymbol, universe } from "@/lib/universe";
import { fetchDailyCloses } from "@/lib/yahoo";
import {
  closesByDate,
  daysAgo,
  klIsoDate,
  lastNDates,
  normalizeTradingDate,
  sma,
  unixToDate,
} from "./math";
import { getWeatherSeriesForRange } from "./weather";
import type { QuantSeriesFactorId } from "./types";

const FX_SYMBOL = "USDMYR=X";
const BOND_PROXY_SYMBOL = "0800EA.KL";
const SECTOR_BREADTH_SYMBOL_LIMIT = 32;
const SECTOR_BREADTH_CONCURRENCY = 6;

function detectInstitution(title: string): boolean {
  return INSTITUTION_PATTERNS.some((entry) => entry.pattern.test(title));
}

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

async function fetchUsdMyrSeries(from: Date): Promise<Map<string, number>> {
  const closes = await fetchDailyCloses(FX_SYMBOL, from);
  return closesByDate(closes);
}

async function fetchBondProxySeries(from: Date): Promise<Map<string, number>> {
  const closes = await fetchDailyCloses(BOND_PROXY_SYMBOL, from);
  return closesByDate(closes);
}

async function fetchOprStepSeries(days: number): Promise<Map<string, number>> {
  const bnm = await getBnmSnapshot("1200");
  const level = bnm.opr.level ?? 0;
  const map = new Map<string, number>();
  for (const date of lastNDates(days)) {
    map.set(date, level);
  }
  return map;
}

async function fetchNewsVelocitySeries(days: number): Promise<Map<string, number>> {
  const query = "Malaysia Bursa listed company earnings acquisition";
  const entries = await fetchRss(
    googleNewsUrl(query, { withinDays: NEWS_WINDOW_DAYS }),
    80,
  );
  return countByDate(entries, days);
}

async function fetchInstitutionalFlowSeries(days: number): Promise<Map<string, number>> {
  const feed = await getAnnouncementsFeed();
  const items = (feed.items ?? []).filter((item) => {
    const hay = `${item.title} ${item.filingType ?? ""}`;
    return /29\s*b|substantial shareholder|shareholding change|notice of interest|notice of change/i.test(
      hay,
    ) && detectInstitution(hay);
  });
  return countByDate(items, days);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

/** Daily % of Bursa names in `sector` trading above their 20-day moving average. */
export async function buildSectorBreadthSeries(from: Date, sector: string): Promise<Map<string, number>> {
  const symbols = universe
    .filter((entry) => entry.sector === sector)
    .slice(0, SECTOR_BREADTH_SYMBOL_LIMIT)
    .map((entry) => entry.symbol);

  if (symbols.length === 0) return new Map();

  const closesBySymbol = await mapWithConcurrency(symbols, SECTOR_BREADTH_CONCURRENCY, async (symbol) => ({
    symbol,
    closes: await fetchDailyCloses(symbol, from).catch(() => [] as Array<{ time: number; close: number }>),
  }));

  const seriesBySymbol = closesBySymbol.map((row) => ({
    symbol: row.symbol,
    points: row.closes.map((point) => ({
      date: unixToDate(point.time),
      close: point.close,
    })),
  }));

  const dateSet = new Set<string>();
  for (const row of seriesBySymbol) {
    for (const point of row.points) dateSet.add(point.date);
  }

  const dates = [...dateSet].sort();
  const map = new Map<string, number>();

  for (const date of dates) {
    let above = 0;
    let total = 0;

    for (const row of seriesBySymbol) {
      const index = row.points.findIndex((point) => point.date === date);
      if (index < 19) continue;

      const window = row.points.slice(index - 19, index + 1).map((point) => point.close);
      const average = sma(window, 20);
      const latest = row.points[index]?.close;
      if (average == null || latest == null) continue;

      total += 1;
      if (latest >= average) above += 1;
    }

    if (total > 0) map.set(date, (above / total) * 100);
  }

  return map;
}

export async function buildFactorSeries(
  factorId: QuantSeriesFactorId,
  days: number,
  symbol?: string,
): Promise<{ series: Map<string, number>; errors: string[]; status: "live" | "degraded" | "fallback" }> {
  const from = daysAgo(days + 35);
  const startDate = klIsoDate(from);
  const endDate = klIsoDate();
  const errors: string[] = [];

  try {
    switch (factorId) {
      case "rainfall": {
        const weather = await getWeatherSeriesForRange(startDate, endDate);
        errors.push(...weather.errors);
        const map = new Map<string, number>();
        for (const row of weather.series) map.set(normalizeTradingDate(row.date), row.precipitationMm);
        return {
          series: map,
          errors,
          status: weather.status,
        };
      }
      case "temperature": {
        const weather = await getWeatherSeriesForRange(startDate, endDate);
        errors.push(...weather.errors);
        const map = new Map<string, number>();
        for (const row of weather.series) map.set(normalizeTradingDate(row.date), row.temperatureC);
        return {
          series: map,
          errors,
          status: weather.status,
        };
      }
      case "usd_myr": {
        const map = await fetchUsdMyrSeries(from);
        return { series: map, errors, status: map.size > 0 ? "live" : "fallback" };
      }
      case "bnm_opr": {
        const map = await fetchOprStepSeries(days + 35);
        return { series: map, errors, status: "live" };
      }
      case "mgs_proxy": {
        const map = await fetchBondProxySeries(from);
        return { series: map, errors, status: map.size > 0 ? "live" : "fallback" };
      }
      case "news_velocity": {
        const map = await fetchNewsVelocitySeries(days + 35);
        return { series: map, errors, status: "live" };
      }
      case "institutional_flow": {
        const map = await fetchInstitutionalFlowSeries(days + 35);
        return { series: map, errors, status: "live" };
      }
      case "sector_breadth": {
        const entry = entryBySymbol(symbol ?? "2445.KL");
        const sector = entry?.sector ?? "Plantation";
        const map = await buildSectorBreadthSeries(from, sector);
        return { series: map, errors, status: map.size > 0 ? "live" : "fallback" };
      }
      default:
        return { series: new Map(), errors: [`Unknown factor: ${factorId}`], status: "fallback" };
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { series: new Map(), errors, status: "fallback" };
  }
}
