import "server-only";

import type { GlobalEconomyPayload, PolicyRate } from "./types";

const REQUEST_TIMEOUT_MS = 8000;

type RateFallback = {
  id: PolicyRate["id"];
  bank: string;
  label: string;
  region: string;
  instrument: string;
  rate: number;
  asOf: string;
  source: string;
};

/**
 * Last published policy prints used when a live central-bank feed is down.
 * Fed and ECB are replaced by the New York Fed and ECB SDMX APIs when they
 * answer; BOJ and PBOC stay on these snapshots until a public JSON feed exists.
 */
const RATE_FALLBACKS: RateFallback[] = [
  {
    id: "fed",
    bank: "Federal Reserve",
    label: "Fed Rate",
    region: "US",
    instrument: "Effective federal funds",
    rate: 4.33,
    asOf: "2025-12-18",
    source: "last-print",
  },
  {
    id: "ecb",
    bank: "European Central Bank",
    label: "ECB Rate",
    region: "EU",
    instrument: "Deposit facility",
    rate: 2.00,
    asOf: "2025-06-11",
    source: "last-print",
  },
  {
    id: "boj",
    bank: "Bank of Japan",
    label: "BOJ Rate",
    region: "Japan",
    instrument: "Policy rate",
    rate: 0.50,
    asOf: "2025-01-24",
    source: "last-print",
  },
  {
    id: "pboc",
    bank: "People's Bank of China",
    label: "PBOC",
    region: "China",
    instrument: "1-year LPR",
    rate: 3.00,
    asOf: "2025-05-20",
    source: "last-print",
  },
];

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null ? (value as Record<string, unknown>) : null;
}

function fromFallback(id: PolicyRate["id"]): PolicyRate {
  const row = RATE_FALLBACKS.find((item) => item.id === id)!;
  return {
    id: row.id,
    bank: row.bank,
    label: row.label,
    region: row.region,
    instrument: row.instrument,
    rate: row.rate,
    changeBps: null,
    asOf: row.asOf,
    source: row.source,
  };
}

function ecbObservationDate(payload: Record<string, unknown> | null): string | null {
  const dimensions = asRecord(asRecord(payload?.structure)?.dimensions);
  const observation = Array.isArray(dimensions?.observation) ? dimensions.observation : [];
  const timeBlock = asRecord(observation[0]);
  const timeEntry = Array.isArray(timeBlock?.values) ? asRecord(timeBlock.values[0]) : null;
  return str(timeEntry?.id) ?? str(timeEntry?.name);
}

async function loadFed(errors: string[]): Promise<PolicyRate> {
  const fallback = fromFallback("fed");
  try {
    const response = await fetch(
      "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json",
      { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (!response.ok) throw new Error(`NY Fed EFFR responded ${response.status}`);

    const payload: unknown = await response.json();
    const rows = Array.isArray(asRecord(payload)?.refRates)
      ? (asRecord(payload)?.refRates as unknown[])
      : [];
    const latest = asRecord(rows[0]);
    const rate = num(latest?.percentRate);
    if (rate == null) throw new Error("NY Fed EFFR missing percentRate");

    const targetFrom = num(latest?.targetFrom);
    const targetTo = num(latest?.targetTo);
    const band =
      targetFrom != null && targetTo != null
        ? `target ${targetFrom.toFixed(2)}–${targetTo.toFixed(2)}%`
        : "effective federal funds";

    return {
      ...fallback,
      instrument: band,
      rate,
      asOf: str(latest?.effectiveDate) ?? new Date().toISOString(),
      source: "ny-fed",
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

async function loadEcb(errors: string[]): Promise<PolicyRate> {
  const fallback = fromFallback("ecb");
  try {
    const response = await fetch(
      "https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?lastNObservations=1&format=jsondata",
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`ECB SDMX responded ${response.status}`);

    const payload = asRecord(await response.json());
    const dataSets = Array.isArray(payload?.dataSets) ? payload.dataSets : [];
    const firstSet = asRecord(dataSets[0]);
    const series = asRecord(firstSet?.series);
    const firstSeries = series ? asRecord(Object.values(series)[0]) : null;
    const observations = asRecord(firstSeries?.observations);
    const firstObs = observations ? Object.values(observations)[0] : null;
    const rate = Array.isArray(firstObs) ? num(firstObs[0]) : null;
    if (rate == null) throw new Error("ECB deposit facility observation missing");

    return {
      ...fallback,
      rate,
      asOf: ecbObservationDate(payload) ?? new Date().toISOString(),
      source: "ecb",
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

export async function getGlobalEconomySnapshot(): Promise<GlobalEconomyPayload> {
  const errors: string[] = [];
  const [fed, ecb] = await Promise.all([loadFed(errors), loadEcb(errors)]);

  return {
    asOf: new Date().toISOString(),
    rates: [fed, ecb, fromFallback("boj"), fromFallback("pboc")],
    markets: [],
    errors,
  };
}
