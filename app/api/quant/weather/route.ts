import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { daysAgo, klIsoDate } from "@/lib/quant/math";
import type { WeatherSeriesResult } from "@/lib/quant/weather";
import { getWeatherSeriesForRange } from "@/lib/quant/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TTL_MS = 15 * 60 * 1000;
const MAX_DAYS = 365;

function parseDays(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "90", 10);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(MAX_DAYS, Math.max(7, parsed));
}

function parseDateRange(request: NextRequest): { startDate: string; endDate: string } {
  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");

  if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { startDate: start, endDate: end };
  }

  const days = parseDays(request.nextUrl.searchParams.get("days"));
  return {
    startDate: klIsoDate(daysAgo(days)),
    endDate: klIsoDate(),
  };
}

export async function GET(request: NextRequest) {
  const { startDate, endDate } = parseDateRange(request);
  const cacheKey = `quant-weather:v1:${startDate}:${endDate}`;

  try {
    const weather = await cached(cacheKey, TTL_MS, () =>
      getWeatherSeriesForRange(startDate, endDate),
    );

    const payload: WeatherSeriesResult & { asOf: string } = {
      ...weather,
      asOf: new Date().toISOString(),
    };

    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
      status: weather.series.length > 0 ? 200 : 503,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    const fallback: WeatherSeriesResult & { asOf: string; error: string } = {
      asOf: new Date().toISOString(),
      series: [],
      errors: [detail],
      status: "fallback",
      startDate,
      endDate,
      source: "open-meteo",
      error: detail,
    };

    return Response.json(fallback, {
      headers: { "Cache-Control": "no-store" },
      status: 503,
    });
  }
}
