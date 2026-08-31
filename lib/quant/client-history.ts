/** Client-side history fetch for Quant Hub interactive engines. */

import { normalizeTradingDate, unixToDate } from "@/lib/quant/math";
import type { HistoryPayload } from "@/lib/types";

export type PriceBar = {
  date: string;
  time: number;
  close: number;
};

export function historyFromCalendarDays(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function toBars(points: HistoryPayload["series"][string] | undefined): PriceBar[] {
  if (!points?.length) return [];
  return points
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .map((point) => ({
      time: point.time,
      close: point.close,
      date: normalizeTradingDate(unixToDate(point.time)),
    }));
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
    series[symbol] = toBars(payload.series[symbol]);
  }

  return { series, errors: payload.errors ?? [] };
}
