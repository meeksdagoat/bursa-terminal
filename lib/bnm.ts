import "server-only";

import { BNM_ACCEPT, BNM_EXCHANGE_URLS, FX_PAIR_DEFS, OPEN_ER_USD_URL, parseOpenErRates, ratesHaveValues } from "./fx-live";
import type { BnmPayload, FxRate, OprSnapshot } from "./types";

/**
 * Bank Negara Malaysia Open API (Kijang portal).
 * The documented host is api.bnm.gov.my; apikijangportal.bnm.gov.my/api/v1 responds 404.
 */
const BNM_BASE = "https://api.bnm.gov.my/public";
const REQUEST_TIMEOUT_MS = 8000;

export const DEFAULT_SESSION = "1200";
export const VALID_SESSIONS = ["0900", "1200", "1700"] as const;

const TRACKED_PAIRS = FX_PAIR_DEFS;

type BnmRateRow = {
  currency_code: string;
  unit: number;
  rate: {
    date: string | null;
    buying_rate: number | null;
    selling_rate: number | null;
    middle_rate: number | null;
  };
};

type BnmOprRow = {
  year: number;
  date: string;
  change_in_opr: number;
  new_opr_level: number;
};

async function bnmGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BNM_BASE}${path}`, {
    headers: { Accept: BNM_ACCEPT },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`BNM ${path} responded ${response.status}`);
  }
  return (await response.json()) as T;
}

function ratePerUnit(row: BnmRateRow): number | null {
  const { buying_rate: buying, selling_rate: selling, middle_rate: middle } = row.rate;
  const raw =
    middle ??
    (buying != null && selling != null ? (buying + selling) / 2 : (buying ?? selling ?? null));
  if (raw == null || !Number.isFinite(raw)) return null;

  const unit = row.unit && row.unit > 0 ? row.unit : 1;
  return raw / unit;
}

function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Walks backwards past weekends and public holidays to find the prior published rate. */
async function previousPublishedRate(
  currencyCode: string,
  fromDate: string,
  session: string,
): Promise<{ rate: number; date: string } | null> {
  let cursor = fromDate;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    cursor = shiftDays(cursor, -1);
    const response = await bnmGet<{ data: BnmRateRow }>(
      `/exchange-rate/${currencyCode.toLowerCase()}/date/${cursor}?session=${session}&quote=rm`,
    );

    const row = response?.data;
    const rate = row ? ratePerUnit(row) : null;
    if (rate != null) {
      return { rate, date: row?.rate.date ?? cursor };
    }
  }

  return null;
}

async function fetchBnmRateList(session: string): Promise<BnmRateRow[]> {
  const query = `session=${session}&quote=rm`;

  for (const url of BNM_EXCHANGE_URLS) {
    try {
      const response = await fetch(`${url}?${query}`, {
        headers: { Accept: BNM_ACCEPT },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 404) continue;
      if (!response.ok) {
        throw new Error(`BNM ${url} responded ${response.status}`);
      }
      const body = (await response.json()) as { data?: BnmRateRow[] };
      const rows = body.data ?? [];
      if (rows.length > 0) return rows;
    } catch (error) {
      console.error("[bnm] exchange-rate fetch failed", url, error);
    }
  }

  const fallback = await bnmGet<{ data: BnmRateRow[] }>(`/exchange-rate?${query}`);
  return fallback?.data ?? [];
}

async function loadOpenErRates(errors: string[]): Promise<FxRate[]> {
  try {
    const response = await fetch(OPEN_ER_USD_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Open ER API responded ${response.status}`);
    return parseOpenErRates(await response.json());
  } catch (error) {
    console.error("[bnm] Open ER API fallback failed", error);
    errors.push(toMessage("open-er", error));
    return FX_PAIR_DEFS.map(({ currencyCode, pair }) => ({
      pair,
      currencyCode,
      rate: null,
      previousRate: null,
      changePct: null,
      date: null,
      previousDate: null,
    }));
  }
}

async function loadRates(session: string, errors: string[]): Promise<FxRate[]> {
  let rows: BnmRateRow[] = [];

  try {
    rows = await fetchBnmRateList(session);
  } catch (error) {
    console.error("[bnm] exchange-rate list failed", error);
    errors.push(toMessage("exchange-rate", error));
  }

  const mapped = await Promise.all(
    TRACKED_PAIRS.map(async ({ currencyCode, pair }) => {
      const row = rows.find((candidate) => candidate.currency_code === currencyCode);
      const rate = row ? ratePerUnit(row) : null;
      const date = row?.rate.date ?? null;

      let previous: { rate: number; date: string } | null = null;
      if (date) {
        try {
          previous = await previousPublishedRate(currencyCode, date, session);
        } catch (error) {
          errors.push(toMessage(`${currencyCode} history`, error));
        }
      }

      const changePct =
        rate != null && previous != null && previous.rate !== 0
          ? ((rate - previous.rate) / previous.rate) * 100
          : null;

      return {
        pair,
        currencyCode,
        rate,
        previousRate: previous?.rate ?? null,
        changePct,
        date,
        previousDate: previous?.date ?? null,
      } satisfies FxRate;
    }),
  );

  if (ratesHaveValues(mapped)) return mapped;

  errors.push("BNM rates empty — falling back to Open ER API");
  return loadOpenErRates(errors);
}

async function loadOpr(errors: string[]): Promise<OprSnapshot> {
  try {
    const response = await bnmGet<{
      data: BnmOprRow;
      meta?: { last_updated?: string };
    }>("/opr");

    const row = response?.data;
    return {
      level: row?.new_opr_level ?? null,
      changeBps: row?.change_in_opr != null ? Math.round(row.change_in_opr * 100) : null,
      effectiveDate: row?.date ?? null,
      lastUpdated: response?.meta?.last_updated ?? null,
    };
  } catch (error) {
    errors.push(toMessage("opr", error));
    return { level: null, changeBps: null, effectiveDate: null, lastUpdated: null };
  }
}

function toMessage(scope: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${scope}: ${detail}`;
}

export function normalizeSession(value: string | null): string {
  return VALID_SESSIONS.includes(value as (typeof VALID_SESSIONS)[number])
    ? (value as string)
    : DEFAULT_SESSION;
}

export async function getBnmSnapshot(session: string): Promise<BnmPayload> {
  const errors: string[] = [];
  const [rates, opr] = await Promise.all([loadRates(session, errors), loadOpr(errors)]);
  const usedOpenEr = errors.some((item) => item.includes("Open ER") || item.includes("open-er"));

  return {
    source: usedOpenEr && ratesHaveValues(rates) ? "open-er" : "bnm",
    session,
    asOf: new Date().toISOString(),
    rates,
    opr,
    errors,
  };
}
