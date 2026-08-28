import "server-only";

const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_FORECAST_PAST_DAYS_MAX = 92;

export type WeatherDaily = {
  date: string;
  precipitationMm: number;
  temperatureC: number;
};

export type WeatherSeriesResult = {
  series: WeatherDaily[];
  errors: string[];
  status: "live" | "degraded" | "fallback";
  startDate: string;
  endDate: string;
  source: "open-meteo";
};

/** Plantation belt + peninsular Malaysia coverage for Open-Meteo daily arrays. */
const MALAYSIA_LOCATIONS = [
  { label: "Peninsular", latitude: 4.2105, longitude: 101.9758 },
  { label: "Johor", latitude: 1.85, longitude: 103.76 },
  { label: "Sabah", latitude: 5.98, longitude: 116.07 },
  { label: "Sarawak", latitude: 1.55, longitude: 110.34 },
] as const;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type OpenMeteoDailyPayload = {
  daily?: {
    time?: string[];
    precipitation_sum?: Array<number | null>;
    temperature_2m_mean?: Array<number | null>;
  };
};

function parseOpenMeteoDaily(payload: OpenMeteoDailyPayload): WeatherDaily[] {
  const times = payload.daily?.time ?? [];
  const precipitation = payload.daily?.precipitation_sum ?? [];
  const temperature = payload.daily?.temperature_2m_mean ?? [];

  return times.flatMap((date, index) => {
    const precipitationMm = finiteNumber(precipitation[index]);
    const temperatureC = finiteNumber(temperature[index]);
    if (precipitationMm == null && temperatureC == null) return [];
    return [
      {
        date,
        precipitationMm: precipitationMm ?? 0,
        temperatureC: temperatureC ?? 0,
      },
    ];
  });
}

function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchForecastDaily(
  latitude: number,
  longitude: number,
  pastDays: number,
): Promise<WeatherDaily[]> {
  const url = new URL(OPEN_METEO_FORECAST);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "precipitation_sum,temperature_2m_mean");
  url.searchParams.set("timezone", "Asia/Kuala_Lumpur");
  url.searchParams.set("past_days", String(Math.min(OPEN_METEO_FORECAST_PAST_DAYS_MAX, Math.max(1, pastDays))));
  url.searchParams.set("forecast_days", "0");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo forecast responded ${response.status}`);
  }

  return parseOpenMeteoDaily((await response.json()) as OpenMeteoDailyPayload);
}

async function fetchArchiveDaily(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<WeatherDaily[]> {
  const url = new URL(OPEN_METEO_ARCHIVE);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", "precipitation_sum,temperature_2m_mean");
  url.searchParams.set("timezone", "Asia/Kuala_Lumpur");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo archive responded ${response.status}`);
  }

  return parseOpenMeteoDaily((await response.json()) as OpenMeteoDailyPayload);
}

async function fetchLocationWeather(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<WeatherDaily[]> {
  const merged = new Map<string, WeatherDaily>();
  const today = new Date().toISOString().slice(0, 10);
  const safeEnd = endDate > today ? today : endDate;
  const requestedSpanDays = Math.max(
    1,
    Math.ceil((Date.parse(`${safeEnd}T12:00:00+08:00`) - Date.parse(`${startDate}T12:00:00+08:00`)) / 86_400_000) + 1,
  );
  const forecastPastDays = Math.min(OPEN_METEO_FORECAST_PAST_DAYS_MAX, requestedSpanDays);

  // Recent window: forecast API exposes `daily.precipitation_sum` / `temperature_2m_mean`.
  try {
    const recent = await fetchForecastDaily(latitude, longitude, forecastPastDays);
    for (const row of recent) {
      if (row.date < startDate || row.date > safeEnd) continue;
      merged.set(row.date, row);
    }
  } catch {
    // Archive fallback below still covers older history.
  }

  // Older history via archive API (extend overlap so forecast/archive gaps do not drop days).
  const archiveEnd = shiftDays(today, -Math.max(1, OPEN_METEO_FORECAST_PAST_DAYS_MAX - 1));
  if (startDate <= archiveEnd) {
    try {
      const archive = await fetchArchiveDaily(
        latitude,
        longitude,
        startDate,
        archiveEnd < safeEnd ? archiveEnd : safeEnd,
      );
      for (const row of archive) {
        if (!merged.has(row.date)) merged.set(row.date, row);
      }
    } catch {
      // Keep whatever forecast data we already parsed.
    }
  }

  return [...merged.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function weatherStatus(
  seriesLength: number,
  errorCount: number,
): WeatherSeriesResult["status"] {
  if (seriesLength === 0) return "fallback";
  return errorCount > 0 ? "degraded" : "live";
}

/** Averages Malaysia daily weather across plantation belt + peninsular nodes. */
export async function fetchPlantationWeather(
  startDate: string,
  endDate: string,
): Promise<{ series: WeatherDaily[]; errors: string[] }> {
  const errors: string[] = [];
  const buckets = new Map<string, { precipitation: number[]; temperature: number[] }>();

  const results = await Promise.allSettled(
    MALAYSIA_LOCATIONS.map((location) =>
      fetchLocationWeather(location.latitude, location.longitude, startDate, endDate),
    ),
  );

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      errors.push(`${MALAYSIA_LOCATIONS[index].label}: ${String(result.reason)}`);
      continue;
    }

    for (const row of result.value) {
      const bucket = buckets.get(row.date) ?? { precipitation: [], temperature: [] };
      bucket.precipitation.push(row.precipitationMm);
      bucket.temperature.push(row.temperatureC);
      buckets.set(row.date, bucket);
    }
  }

  const series = [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      precipitationMm:
        bucket.precipitation.reduce((sum, value) => sum + value, 0) /
        Math.max(1, bucket.precipitation.length),
      temperatureC:
        bucket.temperature.reduce((sum, value) => sum + value, 0) /
        Math.max(1, bucket.temperature.length),
    }));

  return { series, errors };
}

/** Shared Open-Meteo fetch used by `/api/quant/weather` and quant series builders. */
export async function getWeatherSeriesForRange(
  startDate: string,
  endDate: string,
): Promise<WeatherSeriesResult> {
  const { series, errors } = await fetchPlantationWeather(startDate, endDate);
  return {
    series,
    errors,
    status: weatherStatus(series.length, errors.length),
    startDate,
    endDate,
    source: "open-meteo",
  };
}
