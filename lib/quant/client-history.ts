/** Client-side history fetch for Quant Hub interactive engines. */

import type { DailyClose, HistoryPayload } from "@/lib/types";

export type PriceBar = {
  /** Calendar session key, always `YYYY-MM-DD` (UTC from the bar timestamp). */
  date: string;
  time: number;
  close: number;
};

export function historyFromCalendarDays(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Timezone-agnostic ISO date from a unix seconds (or ms) timestamp. */
export function isoDateFromUnix(unix: number): string {
  if (!Number.isFinite(unix)) return "";
  const ms = unix > 1e11 ? unix : unix * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function toIsoDateKey(input: { date?: string; time?: number }): string {
  if (input.time != null && Number.isFinite(input.time)) {
    const fromUnix = isoDateFromUnix(input.time);
    if (fromUnix) return fromUnix;
  }
  const raw = input.date?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (!raw) return "";
  const parsed = Date.parse(raw.length === 10 ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

/** Collapse multiple prints on the same UTC calendar day to the last close. */
export function uniqueBarsByIsoDate(bars: PriceBar[]): PriceBar[] {
  const byDate = new Map<string, PriceBar>();
  for (const bar of bars) {
    const date = toIsoDateKey(bar);
    if (!date || !(bar.close > 0)) continue;
    byDate.set(date, { time: bar.time, close: bar.close, date });
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function toBars(points: DailyClose[] | undefined): PriceBar[] {
  if (!points?.length) return [];
  return uniqueBarsByIsoDate(
    points
      .filter((point) => Number.isFinite(point.close) && point.close > 0)
      .map((point) => ({
        time: point.time,
        close: point.close,
        date: isoDateFromUnix(point.time),
      })),
  );
}

function seriesForSymbol(
  series: HistoryPayload["series"],
  symbol: string,
): DailyClose[] | undefined {
  if (series[symbol]?.length) return series[symbol];
  const needle = symbol.trim().toUpperCase();
  for (const [key, points] of Object.entries(series)) {
    if (key.trim().toUpperCase() === needle && points.length > 0) return points;
  }
  return undefined;
}

export async function fetchPriceBars(
  symbols: string[],
  calendarDays: number,
): Promise<{ series: Record<string, PriceBar[]>; errors: string[] }> {
  const unique = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];
  const from = historyFromCalendarDays(calendarDays);
  const response = await fetch(
    `/api/history?symbols=${encodeURIComponent(unique.join(","))}&from=${from}`,
  );
  const body = (await response.json()) as HistoryPayload | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
  }

  const payload = body as HistoryPayload;
  const series: Record<string, PriceBar[]> = {};
  for (const symbol of unique) {
    series[symbol] = toBars(seriesForSymbol(payload.series, symbol));
  }

  return { series, errors: payload.errors ?? [] };
}
