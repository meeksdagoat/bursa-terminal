import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import duckdb from "duckdb";
import { resolveQuantAsset } from "@/lib/quant/asset-catalog";
import { stripYahooFxSuffix, toYahooFxSymbol } from "@/lib/quant/asset-ticker-map";
import type { ParquetCachedTimeframe } from "@/lib/quant/backtest-timeframe";
import type { BacktestHistoryBar } from "@/lib/types";

export type HistoricalAssetBucket = "XAUUSD" | "BURSA" | "NASDAQ";

const HISTORICAL_DIR = join(process.cwd(), "data", "historical");

export function historicalDataDirectory(): string {
  return HISTORICAL_DIR;
}

export function resolveHistoricalAssetBucket(symbol: string): HistoricalAssetBucket | null {
  const raw = symbol.trim().toUpperCase();
  const asset = resolveQuantAsset(symbol);

  if (asset?.category === "bursa" || raw.endsWith(".KL")) {
    return "BURSA";
  }

  if (
    raw === "XAUUSD=X" ||
    raw === "GC=F" ||
    stripYahooFxSuffix(raw) === "XAUUSD" ||
    (asset?.category === "commodity" && raw.includes("XAU"))
  ) {
    return "XAUUSD";
  }

  if (asset?.category === "commodity") {
    return null;
  }

  if (asset?.category === "global" || /^[A-Z^][A-Z0-9.-]{0,14}$/.test(raw)) {
    return "NASDAQ";
  }

  return null;
}

export function parquetFilePath(
  bucket: HistoricalAssetBucket,
  timeframe: ParquetCachedTimeframe,
): string {
  return join(HISTORICAL_DIR, `${bucket}_${timeframe}.parquet`);
}

export function parquetFileExists(
  bucket: HistoricalAssetBucket,
  timeframe: ParquetCachedTimeframe,
): boolean {
  return existsSync(parquetFilePath(bucket, timeframe));
}

function duckDbPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function runDuckDbAll(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(":memory:");
    const connection = db.connect();
    connection.all(sql, ...params, (error: Error | null, rows: duckdb.TableData) => {
      connection.close();
      db.close();
      if (error) reject(error);
      else resolve((rows ?? []) as Record<string, unknown>[]);
    });
  });
}

function rowToBar(row: Record<string, unknown>): BacktestHistoryBar | null {
  const time =
    typeof row.time === "number"
      ? row.time
      : typeof row.time === "bigint"
        ? Number(row.time)
        : null;
  const close = typeof row.close === "number" ? row.close : null;
  if (time == null || close == null || !Number.isFinite(close) || close <= 0) return null;

  const open = typeof row.open === "number" ? row.open : close;
  const high = typeof row.high === "number" ? row.high : Math.max(open, close);
  const low = typeof row.low === "number" ? row.low : Math.min(open, close);
  const volume =
    typeof row.volume === "number"
      ? row.volume
      : typeof row.volume === "bigint"
        ? Number(row.volume)
        : null;

  return { time, open, high, low, close, volume };
}

export async function fetchParquetBacktestBars(input: {
  symbol: string;
  timeframe: ParquetCachedTimeframe;
  from: string;
  to: string;
}): Promise<{
  bars: BacktestHistoryBar[];
  bucket: HistoricalAssetBucket | null;
  parquetPath: string | null;
  warning: string | null;
}> {
  const bucket = resolveHistoricalAssetBucket(input.symbol);
  if (!bucket) {
    return {
      bars: [],
      bucket: null,
      parquetPath: null,
      warning: `${input.symbol} is not available in the local historical cache (supported: XAUUSD, BURSA, NASDAQ).`,
    };
  }

  const filePath = parquetFilePath(bucket, input.timeframe);
  if (!existsSync(filePath)) {
    return {
      bars: [],
      bucket,
      parquetPath: filePath,
      warning:
        `Local parquet cache missing: ${bucket}_${input.timeframe}.parquet — ` +
        `run npm run ingest:historical to build /data/historical/.`,
    };
  }

  const parquetPath = duckDbPath(filePath);
  const fromTs = `${input.from} 00:00:00`;
  const toTs = `${input.to} 23:59:59`;
  const querySymbol = bucket === "XAUUSD" ? toYahooFxSymbol(input.symbol) : input.symbol.trim().toUpperCase();

  const sql =
    bucket === "XAUUSD"
      ? `
        SELECT
          CAST(epoch(timestamp) AS BIGINT) AS time,
          open, high, low, close, volume
        FROM read_parquet('${parquetPath}')
        WHERE timestamp >= CAST(? AS TIMESTAMP)
          AND timestamp <= CAST(? AS TIMESTAMP)
        ORDER BY timestamp ASC
      `
      : `
        SELECT
          CAST(epoch(timestamp) AS BIGINT) AS time,
          open, high, low, close, volume
        FROM read_parquet('${parquetPath}')
        WHERE symbol = ?
          AND timestamp >= CAST(? AS TIMESTAMP)
          AND timestamp <= CAST(? AS TIMESTAMP)
        ORDER BY timestamp ASC
      `;

  const params =
    bucket === "XAUUSD" ? [fromTs, toTs] : [querySymbol, fromTs, toTs];

  try {
    const rows = await runDuckDbAll(sql, params);
    const bars = rows
      .map((row) => rowToBar(row))
      .filter((bar): bar is BacktestHistoryBar => bar != null);

    return {
      bars,
      bucket,
      parquetPath: filePath,
      warning:
        bars.length === 0
          ? `No ${input.timeframe} bars in local cache for ${input.symbol} between ${input.from} and ${input.to}.`
          : null,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      bars: [],
      bucket,
      parquetPath: filePath,
      warning: `DuckDB parquet query failed: ${detail}`,
    };
  }
}
