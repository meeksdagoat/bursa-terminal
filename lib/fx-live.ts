import type { FxRate } from "./types";

export const FX_PAIRS = ["USD/MYR", "SGD/MYR", "EUR/MYR", "CNY/MYR"] as const;
export type FxPair = (typeof FX_PAIRS)[number];

export const FX_PAIR_DEFS: ReadonlyArray<{ currencyCode: string; pair: FxPair }> = [
  { currencyCode: "USD", pair: "USD/MYR" },
  { currencyCode: "SGD", pair: "SGD/MYR" },
  { currencyCode: "EUR", pair: "EUR/MYR" },
  { currencyCode: "CNY", pair: "CNY/MYR" },
];

export const BNM_ACCEPT = "application/vnd.BNM.API.v1+json";
export const OPEN_ER_USD_URL = "https://open.er-api.com/v6/latest/USD";

/** Documented v1 host plus the working public path. v1 404s; public is the live Kijang feed. */
export const BNM_EXCHANGE_URLS = [
  "https://api.bnm.gov.my/v1/exchange-rate",
  "https://api.bnm.gov.my/public/exchange-rate",
] as const;

export const ECONOMY_POLL_MS = 30_000;

type OpenErPayload = {
  result?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function quoteMyr(usdMyr: number, foreignPerUsd: number | null): number | null {
  if (foreignPerUsd == null || foreignPerUsd === 0) return null;
  return usdMyr / foreignPerUsd;
}

export function ratesHaveValues(rates: FxRate[] | null | undefined): boolean {
  return (rates ?? []).some((rate) => rate.rate != null && Number.isFinite(rate.rate));
}

/** Convert a USD-base Open ER snapshot into MYR crosses. */
export function parseOpenErRates(payload: unknown, previous?: Map<string, number>): FxRate[] {
  const body = (payload ?? {}) as OpenErPayload;
  const table = body.rates ?? {};
  const usdMyr = num(table.MYR);
  const asOf = typeof body.time_last_update_utc === "string" ? body.time_last_update_utc.slice(0, 10) : null;

  const byCode: Record<string, number | null> = {
    USD: usdMyr,
    SGD: usdMyr != null ? quoteMyr(usdMyr, num(table.SGD)) : null,
    EUR: usdMyr != null ? quoteMyr(usdMyr, num(table.EUR)) : null,
    CNY: usdMyr != null ? quoteMyr(usdMyr, num(table.CNY)) : null,
  };

  return FX_PAIR_DEFS.map(({ currencyCode, pair }) => {
    const rate = byCode[currencyCode] ?? null;
    const prior = previous?.get(pair) ?? null;
    const changePct =
      rate != null && prior != null && prior !== 0 ? ((rate - prior) / prior) * 100 : null;

    return {
      pair,
      currencyCode,
      rate,
      previousRate: prior,
      changePct,
      date: asOf,
      previousDate: null,
    } satisfies FxRate;
  });
}
