import "server-only";

import { cached } from "./cache";
import { capSizeOf } from "./screener-filters";
import type { ScreenerPayload, ScreenerRow } from "./types";
import { universe } from "./universe";
import { fetchScreenerMetrics, type ScreenerQuoteMetrics } from "./yahoo";

const TTL_MS = 30 * 60 * 1000;
const CHUNK_SIZE = 45;
const CONCURRENCY = 6;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function mapPool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await work(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const rank = Math.min(values.length - 1, Math.max(0, Math.round((p / 100) * (values.length - 1))));
  return values[rank] ?? 0;
}

function boundsOf(values: number[], fallbackMax: number, ceil: number): { min: number; max: number } {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return { min: 0, max: fallbackMax };
  const high = Math.min(ceil, Math.max(fallbackMax, Math.ceil(percentile(sorted, 95))));
  return { min: 0, max: high };
}

async function loadMetrics(): Promise<{ bySymbol: Map<string, ScreenerQuoteMetrics>; errors: string[] }> {
  const batches = chunk(
    universe.map((entry) => entry.symbol),
    CHUNK_SIZE,
  );
  const errors: string[] = [];

  const results = await mapPool(batches, CONCURRENCY, async (symbols) => {
    try {
      return await fetchScreenerMetrics(symbols);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return [] as ScreenerQuoteMetrics[];
    }
  });

  return {
    bySymbol: new Map(results.flat().map((row) => [row.symbol, row])),
    errors,
  };
}

function sanePe(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0 || value > 200) return null;
  return value;
}

function sanePct(value: number | null, max = 40): number | null {
  if (value == null || !Number.isFinite(value) || Math.abs(value) > max) return null;
  return value;
}

function buildSnapshot(
  bySymbol: Map<string, ScreenerQuoteMetrics>,
  errors: string[],
): ScreenerPayload {
  const rows: ScreenerRow[] = universe.map((entry) => {
    const metrics = bySymbol.get(entry.symbol);
    const marketCap = metrics?.marketCap ?? null;
    return {
      symbol: entry.symbol,
      code: entry.code,
      name: entry.name,
      shortName: entry.shortName,
      sector: entry.sector,
      shariah: entry.shariah,
      pe: sanePe(metrics?.pe ?? null),
      dividendYieldPct: sanePct(metrics?.dividendYieldPct ?? null, 25),
      marketCap,
      roe: sanePct(metrics?.roe ?? null, 80),
      capSize: capSizeOf(marketCap),
    };
  });

  const peValues = rows.flatMap((row) => (row.pe != null && row.pe > 0 ? [row.pe] : []));
  const yieldValues = rows.flatMap((row) =>
    row.dividendYieldPct != null && row.dividendYieldPct > 0 ? [row.dividendYieldPct] : [],
  );

  return {
    source: "yahoo",
    asOf: new Date().toISOString(),
    covered: [...bySymbol.keys()].length,
    universe: universe.length,
    errors,
    sectors: [...new Set(rows.map((row) => row.sector))].sort((a, b) => a.localeCompare(b)),
    peBounds: boundsOf(peValues, 40, 120),
    yieldBounds: boundsOf(yieldValues, 8, 20),
    rows,
  };
}

export async function getScreenerSnapshot(): Promise<ScreenerPayload> {
  return cached("screener:yahoo:v2", TTL_MS, async () => {
    const { bySymbol, errors } = await loadMetrics();
    return buildSnapshot(bySymbol, errors);
  });
}
