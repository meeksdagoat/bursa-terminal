#!/usr/bin/env node
/**
 * Build / refresh local Parquet OHLCV cache for 15m and 30m backtests.
 * Usage: node scripts/ingest-historical-parquet.mjs
 */

import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import duckdb from "duckdb";
import YahooFinance from "yahoo-finance2";

const HISTORICAL_DIR = join(process.cwd(), "data", "historical");
/** Yahoo intraday chart API caps 15m/30m history at ~60 calendar days. */
const INTRADAY_CALENDAR_DAYS = 60;

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

const JOBS = [
  {
    bucket: "XAUUSD",
    multiSymbol: false,
    symbols: ["XAUUSD=X", "GC=F", "GLD"],
  },
  {
    bucket: "BURSA",
    multiSymbol: true,
    symbols: ["1155.KL"],
  },
  {
    bucket: "NASDAQ",
    multiSymbol: true,
    symbols: ["QQQ", "AAPL", "NVDA"],
  },
];

const TIMEFRAMES = [
  { id: "15m", yahooInterval: "15m" },
  { id: "30m", yahooInterval: "30m" },
];

function toUnixSeconds(value) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return value > 1e11 ? Math.floor(value / 1000) : value;
  return null;
}

async function fetchYahooBarsDirect(symbol, interval) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=60d&includePrePost=false`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; BursaTerminal/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];
  const rows = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const time = timestamps[index];
    const close = closes[index];
    if (typeof time !== "number" || typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    const open = typeof opens[index] === "number" ? opens[index] : close;
    const high = typeof highs[index] === "number" ? highs[index] : Math.max(open, close);
    const low = typeof lows[index] === "number" ? lows[index] : Math.min(open, close);
    rows.push({
      symbol: symbol.toUpperCase(),
      timestamp: new Date(time * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: typeof volumes[index] === "number" ? volumes[index] : 0,
    });
  }
  return rows;
}

async function fetchYahooBars(symbol, interval, period1, period2) {
  try {
    return await fetchYahooBarsDirect(symbol, interval);
  } catch {
    const result = await yahoo.chart(
      symbol,
      { period1, period2, interval },
      { validateResult: false },
    );
    const quotes = result?.quotes ?? [];
    const rows = [];
    for (const row of quotes) {
      const time = toUnixSeconds(row.date);
      const close = typeof row.close === "number" ? row.close : null;
      if (time == null || close == null || !Number.isFinite(close) || close <= 0) continue;
      rows.push({
        symbol: symbol.toUpperCase(),
        timestamp: new Date(time * 1000).toISOString(),
        open: typeof row.open === "number" ? row.open : close,
        high: typeof row.high === "number" ? row.high : Math.max(row.open ?? close, close),
        low: typeof row.low === "number" ? row.low : Math.min(row.open ?? close, close),
        close,
        volume: typeof row.volume === "number" ? row.volume : 0,
      });
    }
    return rows;
  }
}

function runDuckDb(sql) {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(":memory:");
    const conn = db.connect();
    conn.run(sql, (error) => {
      try {
        conn.close();
      } catch {
        // ignore close errors
      }
      try {
        db.close();
      } catch {
        // ignore close errors
      }
      if (error) reject(error);
      else resolve();
    });
  });
}

function escapeLiteral(value) {
  return String(value).replace(/'/g, "''");
}

async function writeParquet({ bucket, multiSymbol, symbols, timeframe, yahooInterval }) {
  const period2 = new Date();
  const period1 = new Date(Date.now() - INTRADAY_CALENDAR_DAYS * 86_400_000);
  const allRows = [];

  for (const symbol of symbols) {
    try {
      console.log(`  Fetching ${symbol} ${yahooInterval}…`);
      const rows = await fetchYahooBars(symbol, yahooInterval, period1, period2);
      if (rows.length === 0) {
        console.warn(`    ${symbol}: empty`);
        continue;
      }
      allRows.push(...rows);
      console.log(`    ${rows.length} bars`);
      if (!multiSymbol) break;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`    ${symbol} failed: ${detail}`);
    }
  }

  if (allRows.length === 0) {
    console.warn(`  Skipping ${bucket}_${timeframe.id}.parquet — no rows fetched.`);
    return;
  }

  allRows.sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const outPath = join(HISTORICAL_DIR, `${bucket}_${timeframe.id}.parquet`).replace(/\\/g, "/");
  const values = allRows
    .map((row) => {
      if (multiSymbol) {
        return (
          `('${escapeLiteral(row.symbol)}', TIMESTAMP '${row.timestamp}', ` +
          `${row.open}, ${row.high}, ${row.low}, ${row.close}, ${row.volume})`
        );
      }
      return (
        `(TIMESTAMP '${row.timestamp}', ${row.open}, ${row.high}, ${row.low}, ${row.close}, ${row.volume})`
      );
    })
    .join(",\n");

  const createSql = multiSymbol
    ? `
      CREATE TABLE bars AS
      SELECT * FROM (VALUES ${values}) AS t(symbol, timestamp, open, high, low, close, volume);
      COPY bars TO '${outPath}' (FORMAT PARQUET, COMPRESSION ZSTD);
    `
    : `
      CREATE TABLE bars AS
      SELECT * FROM (VALUES ${values}) AS t(timestamp, open, high, low, close, volume);
      COPY bars TO '${outPath}' (FORMAT PARQUET, COMPRESSION ZSTD);
    `;

  await runDuckDb(createSql);
  console.log(`  Wrote ${outPath} (${allRows.length} rows)`);
}

async function main() {
  if (!existsSync(HISTORICAL_DIR)) {
    mkdirSync(HISTORICAL_DIR, { recursive: true });
  }

  for (const job of JOBS) {
    for (const timeframe of TIMEFRAMES) {
      console.log(`\n[${job.bucket}] ${timeframe.id}`);
      await writeParquet({ ...job, timeframe, yahooInterval: timeframe.yahooInterval });
    }
  }

  console.log("\nDone. Parquet cache ready under data/historical/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
