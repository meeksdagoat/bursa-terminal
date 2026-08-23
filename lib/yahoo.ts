import "server-only";

import YahooFinance from "yahoo-finance2";
import type { RangeKey } from "./ranges";
import type { Candle, CandlesPayload, Quote } from "./types";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

type RangeConfig = {
  lookbackDays: number;
  interval: "5m" | "30m" | "1d";
  intraday: boolean;
  /** For intraday ranges, how many trading sessions to keep after trimming. */
  sessions?: number;
};

const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  // Intraday windows are over-fetched, then trimmed to whole sessions so a
  // weekend or holiday never yields an empty chart.
  "1D": { lookbackDays: 7, interval: "5m", intraday: true, sessions: 1 },
  "5D": { lookbackDays: 12, interval: "30m", intraday: true, sessions: 5 },
  "1M": { lookbackDays: 32, interval: "1d", intraday: false },
  "6M": { lookbackDays: 190, interval: "1d", intraday: false },
  "1Y": { lookbackDays: 370, interval: "1d", intraday: false },
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

export async function fetchCandles(symbol: string, range: RangeKey): Promise<CandlesPayload> {
  const config = RANGE_CONFIG[range];
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

  if (config.intraday && config.sessions) {
    const days = [...new Set(candles.map((candle) => klTradingDay(candle.time)))];
    const keep = new Set(days.slice(-config.sessions));
    candles = candles.filter((candle) => keep.has(klTradingDay(candle.time)));
  }

  return {
    symbol,
    range,
    interval: config.interval,
    intraday: config.intraday,
    currency: str(payload.meta?.currency),
    previousClose:
      num(payload.meta?.chartPreviousClose) ?? num(payload.meta?.previousClose) ?? null,
    candles,
  };
}
