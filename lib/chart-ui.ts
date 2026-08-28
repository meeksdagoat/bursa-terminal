import type { Time } from "lightweight-charts";
import { formatKlChartCrosshairTime } from "@/lib/format";

export function chartTimeToDate(time: Time): Date | null {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") {
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (time && typeof time === "object" && "year" in time) {
    return new Date(Date.UTC(time.year, time.month - 1, time.day));
  }
  return null;
}

/** Lightweight Charts crosshair label: `DD MMM YYYY, HH:mm` in Malaysia Time. */
export function formatChartCrosshairTime(time: Time): string {
  const date = chartTimeToDate(time);
  return date ? formatKlChartCrosshairTime(date.getTime()) : "";
}

export type ChartOverlays = {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema: boolean;
  volumeProfile: boolean;
  rsi: boolean;
  macd: boolean;
};

export type DrawingTool = "cursor" | "trendline" | "hline" | "fib";

export const EMPTY_OVERLAYS: ChartOverlays = {
  sma20: false,
  sma50: false,
  sma200: false,
  ema: false,
  volumeProfile: false,
  rsi: false,
  macd: false,
};
