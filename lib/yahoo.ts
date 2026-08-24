import "server-only";

import YahooFinance from "yahoo-finance2";
import { usableArticleText } from "./eli5";
import type { IntervalKey, RangeKey } from "./ranges";
import type { Candle, CandlesPayload, Quote } from "./types";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

type YahooInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1wk";

type RangeConfig = {
  lookbackDays: number;
  interval: YahooInterval;
  intraday: boolean;
  /** For intraday ranges, how many trading sessions to keep after trimming. */
  sessions?: number;
};

const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  // Intraday windows are over-fetched, then trimmed to whole sessions so a
  // weekend or holiday never yields an empty chart.
  "1D": { lookbackDays: 7, interval: "5m", intraday: true, sessions: 1 },
  "5D": { lookbackDays: 12, interval: "30m", intraday: true, sessions: 5 },
  "1W": { lookbackDays: 12, interval: "30m", intraday: true, sessions: 5 },
  "1M": { lookbackDays: 32, interval: "1d", intraday: false },
  "3M": { lookbackDays: 95, interval: "1d", intraday: false },
  "6M": { lookbackDays: 190, interval: "1d", intraday: false },
  "1Y": { lookbackDays: 370, interval: "1d", intraday: false },
  ALL: { lookbackDays: 20 * 365, interval: "1wk", intraday: false },
};

type IntervalConfig = RangeConfig & {
  /** Yahoo has no native 4h bars — fetch 60m and bucket. */
  bucketMinutes?: number;
};

const INTERVAL_CONFIG: Record<IntervalKey, IntervalConfig> = {
  "1m": { lookbackDays: 7, interval: "1m", intraday: true },
  "5m": { lookbackDays: 60, interval: "5m", intraday: true },
  "15m": { lookbackDays: 60, interval: "15m", intraday: true },
  "30m": { lookbackDays: 60, interval: "30m", intraday: true },
  "1h": { lookbackDays: 60, interval: "60m", intraday: true },
  "4h": { lookbackDays: 60, interval: "60m", intraday: true, bucketMinutes: 240 },
  "1D": { lookbackDays: 370, interval: "1d", intraday: false },
  "1W": { lookbackDays: 5 * 365, interval: "1wk", intraday: false },
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toUnixSeconds(value: unknown): number | null {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return value > 1e11 ? Math.floor(value / 1000) : value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }
  return null;
}

const klDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function klTradingDay(unixSeconds: number): string {
  return klDateFormatter.format(new Date(unixSeconds * 1000));
}

function normalizeQuote(row: Record<string, unknown>): Quote {
  const trailingYield = num(row.trailingAnnualDividendYield);
  const plainYield = num(row.dividendYield);
  const dividendYieldPct =
    trailingYield != null
      ? trailingYield * 100
      : plainYield != null
        ? plainYield > 1
          ? plainYield
          : plainYield * 100
        : null;

  return {
    symbol: str(row.symbol) ?? "",
    name: str(row.shortName) ?? str(row.longName),
    price: num(row.regularMarketPrice),
    change: num(row.regularMarketChange),
    changePct: num(row.regularMarketChangePercent),
    previousClose: num(row.regularMarketPreviousClose),
    dayHigh: num(row.regularMarketDayHigh),
    dayLow: num(row.regularMarketDayLow),
    yearHigh: num(row.fiftyTwoWeekHigh),
    yearLow: num(row.fiftyTwoWeekLow),
    volume: num(row.regularMarketVolume),
    pe: num(row.trailingPE),
    marketCap: num(row.marketCap),
    dividendYieldPct,
    currency: str(row.currency),
    marketState: str(row.marketState),
    delayMinutes: num(row.exchangeDataDelayedBy),
    quoteTime: (() => {
      const seconds = toUnixSeconds(row.regularMarketTime);
      return seconds == null ? null : new Date(seconds * 1000).toISOString();
    })(),
  };
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const raw: unknown = await yahoo.quote(symbols, {}, { validateResult: false });
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map(normalizeQuote)
    .filter((quote) => quote.symbol.length > 0);
}

export type TickerNewsItem = {
  id: string;
  headline: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  relatedTickers: string[];
  snippet: string | null;
};

function newsDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return null;
}

function parseYahooNews(raw: unknown): TickerNewsItem[] {
  const payload = (raw ?? {}) as { news?: unknown };
  const rows = Array.isArray(payload.news) ? payload.news : [];

  return rows.flatMap((row) => {
    if (typeof row !== "object" || row == null) return [];
    const item = row as Record<string, unknown>;
    const headline = str(item.title);
    if (!headline) return [];

    const related = Array.isArray(item.relatedTickers)
      ? item.relatedTickers.filter((ticker): ticker is string => typeof ticker === "string")
      : [];

    return [
      {
        id: str(item.uuid) ?? str(item.link) ?? headline,
        headline,
        source: str(item.publisher) ?? "Yahoo Finance",
        url: str(item.link),
        publishedAt: newsDate(item.providerPublishTime),
        relatedTickers: related,
        snippet: usableArticleText(str(item.summary) ?? str(item.snippet), headline),
      } satisfies TickerNewsItem,
    ];
  });
}

/** Live Yahoo Finance news tied to a Bursa ticker (and a second search on the press name). */
export async function fetchTickerNews(symbol: string, name: string): Promise<TickerNewsItem[]> {
  const queries = [...new Set([symbol, name])];
  const seen = new Set<string>();
  const items: TickerNewsItem[] = [];

  const results = await Promise.all(
    queries.map(async (query) => {
      try {
        const raw: unknown = await yahoo.search(
          query,
          { quotesCount: 1, newsCount: 20, region: "MY", lang: "en-MY" },
          { validateResult: false },
        );
        return parseYahooNews(raw);
      } catch {
        return [] as TickerNewsItem[];
      }
    }),
  );

  for (const item of results.flat()) {
    const key = item.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return items;
}

const QUOTE_SUMMARY_MODULES = [
  "summaryDetail",
  "financialData",
  "defaultKeyStatistics",
  "calendarEvents",
  "price",
] as const;

/**
 * Yahoo quoteSummary for the modules the Bursa deep-dive panel reads.
 * yahoo-finance2 hits the same v10 quoteSummary endpoint and carries the crumb.
 */
export async function fetchQuoteSummary(symbol: string): Promise<unknown> {
  return yahoo.quoteSummary(
    symbol,
    { modules: [...QUOTE_SUMMARY_MODULES] },
    { validateResult: false },
  );
}

export type FundamentalsSeriesType = "annual" | "quarterly";
export type FundamentalsSeriesModule = "financials" | "balance-sheet" | "cash-flow" | "all";

/**
 * Yahoo fundamentals-timeseries statements. Unreported periods are omitted
 * (`padTimeSeries: false`); do not invent values client-side.
 */
export async function fetchFundamentalsTimeSeries(
  symbol: string,
  options: {
    period1: string | Date;
    period2?: string | Date;
    type: FundamentalsSeriesType;
    module: FundamentalsSeriesModule;
  },
): Promise<unknown[]> {
  const raw: unknown = await yahoo.fundamentalsTimeSeries(
    symbol,
    {
      period1: options.period1,
      ...(options.period2 ? { period2: options.period2 } : {}),
      type: options.type,
      module: options.module,
      padTimeSeries: false,
      merge: false,
      region: "MY",
      lang: "en-MY",
    },
    { validateResult: false },
  );

  return Array.isArray(raw) ? raw : [];
}

export async function fetchDailyCloses(
  symbol: string,
  period1: Date,
): Promise<Array<{ time: number; close: number }>> {
  const result: unknown = await yahoo.chart(
    symbol,
    { period1, interval: "1d" },
    { validateResult: false },
  );

  const payload = (result ?? {}) as {
    quotes?: Array<Record<string, unknown>>;
  };

  return (payload.quotes ?? []).flatMap((row) => {
    const time = toUnixSeconds(row.date);
    const close = num(row.close) ?? num(row.adjclose);
    if (time == null || close == null) return [];
    return [{ time, close }];
  });
}

export async function fetchCandles(symbol: string, range: RangeKey): Promise<CandlesPayload> {
  return loadCandles(symbol, range, RANGE_CONFIG[range]);
}

export async function fetchIntervalCandles(
  symbol: string,
  interval: IntervalKey,
): Promise<CandlesPayload> {
  return loadCandles(symbol, interval, INTERVAL_CONFIG[interval]);
}

async function loadCandles(
  symbol: string,
  label: string,
  config: IntervalConfig,
): Promise<CandlesPayload> {
  const period1 = new Date(Date.now() - config.lookbackDays * 86_400_000);

  const result: unknown = await yahoo.chart(
    symbol,
    { period1, interval: config.interval },
    { validateResult: false },
  );

  const payload = (result ?? {}) as {
    meta?: Record<string, unknown>;
    quotes?: Array<Record<string, unknown>>;
  };

  let candles: Candle[] = (payload.quotes ?? []).flatMap((row) => {
    const time = toUnixSeconds(row.date);
    const open = num(row.open);
    const high = num(row.high);
    const low = num(row.low);
    const close = num(row.close);

    if (time == null || open == null || high == null || low == null || close == null) {
      return [];
    }
    return [{ time, open, high, low, close, volume: num(row.volume) }];
  });

  if (config.bucketMinutes) {
    candles = aggregateCandles(candles, config.bucketMinutes);
  }

  if (config.intraday && config.sessions) {
    const days = [...new Set(candles.map((candle) => klTradingDay(candle.time)))];
    const keep = new Set(days.slice(-config.sessions));
    candles = candles.filter((candle) => keep.has(klTradingDay(candle.time)));
  }

  return {
    symbol,
    range: label,
    interval: label,
    intraday: config.intraday,
    currency: str(payload.meta?.currency),
    previousClose:
      num(payload.meta?.chartPreviousClose) ?? num(payload.meta?.previousClose) ?? null,
    candles,
  };
}

function aggregateCandles(candles: Candle[], bucketMinutes: number): Candle[] {
  const bucketSeconds = bucketMinutes * 60;
  const buckets = new Map<number, Candle>();

  for (const candle of candles) {
    const time = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(time);
    if (!existing) {
      buckets.set(time, { ...candle, time });
      continue;
    }
    buckets.set(time, {
      time,
      open: existing.open,
      high: Math.max(existing.high, candle.high),
      low: Math.min(existing.low, candle.low),
      close: candle.close,
      volume:
        existing.volume == null && candle.volume == null
          ? null
          : (existing.volume ?? 0) + (candle.volume ?? 0),
    });
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time);
}
