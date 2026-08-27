import "server-only";

import { formatKlFullDate } from "./format";
import type { BursaQuote } from "./types";
import { fetchQuoteSummary } from "./yahoo";

const YAHOO_SUMMARY_URL =
  "https://query1.finance.yahoo.com/v10/finance/quoteSummary";
const YAHOO_MODULES =
  "summaryDetail,financialData,defaultKeyStatistics,calendarEvents,price";

/**
 * Live Yahoo quoteSummary for a Bursa ticker. Tries the public v10 endpoint
 * first (as documented), then falls back to yahoo-finance2 which supplies the
 * crumb Yahoo now requires.
 */
export async function getBursaQuote(symbol: string): Promise<BursaQuote> {
  const payload = await loadQuoteSummary(symbol);
  return mapBursaQuote(symbol, payload);
}

async function loadQuoteSummary(symbol: string): Promise<unknown> {
  try {
    return await fetchPublicQuoteSummary(symbol);
  } catch {
    return fetchQuoteSummary(symbol);
  }
}

async function fetchPublicQuoteSummary(symbol: string): Promise<unknown> {
  const url = `${YAHOO_SUMMARY_URL}/${encodeURIComponent(symbol)}?modules=${YAHOO_MODULES}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) {
    throw new Error(`Yahoo quoteSummary ${response.status}`);
  }

  const payload: unknown = await response.json();
  const wrapped = asRecord(payload)?.quoteSummary;
  const bag = asRecord(wrapped);
  if (bag?.error) throw new Error(String(bag.error));

  return payload;
}

function mapBursaQuote(symbol: string, payload: unknown): BursaQuote {
  const result = unwrapResult(payload);
  const price = asRecord(result.price);
  const summary = asRecord(result.summaryDetail);
  const financials = asRecord(result.financialData);
  const calendar = asRecord(result.calendarEvents);
  const earnings = asRecord(calendar?.earnings);
  const stats = asRecord(result.defaultKeyStatistics);

  const last = num(financials?.currentPrice) ?? num(price?.regularMarketPrice) ?? num(summary?.previousClose);
  const earningsDates = collectDates(earnings?.earningsDate);
  const exDividendAt = isoDate(calendar?.exDividendDate) ?? isoDate(summary?.exDividendDate);
  const dividendAt = isoDate(calendar?.dividendDate) ?? isoDate(stats?.lastDividendDate);

  return {
    source: "yahoo",
    symbol: str(price?.symbol) ?? symbol,
    companyName: str(price?.shortName) ?? str(price?.longName) ?? symbol,
    price: last,
    dayChangePercent: toPercent(num(price?.regularMarketChangePercent)),
    marketCap: num(summary?.marketCap) ?? num(price?.marketCap),
    peRatio: num(summary?.trailingPE) ?? num(stats?.forwardPE),
    dividendYield: toPercent(num(summary?.dividendYield) ?? num(summary?.trailingAnnualDividendYield)),
    roe: toPercent(num(financials?.returnOnEquity)),
    priceToBook: priceToBookOf(last, stats, summary),
    exDividendDate: formattedDate(calendar?.exDividendDate) ?? formattedDate(summary?.exDividendDate),
    earningsDate: formatEarningsRange(earningsDates),
    exDividendAt,
    dividendAt,
    earningsAt: earningsDates,
    asOf: new Date().toISOString(),
  };
}

function priceToBookOf(
  last: number | null,
  stats: Record<string, unknown> | null,
  summary: Record<string, unknown> | null,
): number | null {
  const quoted = num(stats?.priceToBook) ?? num(summary?.priceToBook);
  if (quoted != null && quoted > 0) return quoted;
  const book = num(stats?.bookValue) ?? num(summary?.bookValue);
  if (last == null || book == null || book === 0) return null;
  const ratio = last / book;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

function unwrapResult(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload);
  if (!root) throw new Error("Empty Yahoo quoteSummary");

  const wrapped = asRecord(root.quoteSummary);
  if (wrapped) {
    const rows = Array.isArray(wrapped.result) ? wrapped.result : [];
    const first = asRecord(rows[0]);
    if (!first) throw new Error("Yahoo quoteSummary returned no result");
    return first;
  }

  return root;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const bag = asRecord(value);
  if (bag && typeof bag.raw === "number" && Number.isFinite(bag.raw)) return bag.raw;
  return null;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const bag = asRecord(value);
  if (!bag) return null;
  if (typeof bag.raw === "number") return isoDate(bag.raw);
  if (typeof bag.fmt === "string") return isoDate(bag.fmt);
  return null;
}

function formattedDate(value: unknown): string | null {
  const bag = asRecord(value);
  if (typeof bag?.fmt === "string" && bag.fmt.length > 0) return bag.fmt;
  const iso = isoDate(value);
  return iso ? formatKlFullDate(iso) : null;
}

function collectDates(value: unknown): string[] {
  const rows = Array.isArray(value) ? value : value == null ? [] : [value];
  const dates = rows.flatMap((row) => {
    const iso = isoDate(row);
    return iso ? [iso] : [];
  });
  return [...new Set(dates)].sort();
}

function formatEarningsRange(dates: string[]): string | null {
  if (dates.length === 0) return null;
  if (dates.length === 1) return formatKlFullDate(dates[0]);
  return `${formatKlFullDate(dates[0])} – ${formatKlFullDate(dates[dates.length - 1])}`;
}

/** Yahoo yields/ROE/day change arrive as 0.059 or already as 5.9. */
function toPercent(value: number | null): number | null {
  if (value == null) return null;
  const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
  return Math.round(pct * 100) / 100;
}
