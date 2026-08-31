# Local historical OHLCV cache (Parquet)

Backtest **15m** and **30m** timeframes read from compressed Parquet files queried via DuckDB. All other timeframes use Yahoo Finance live or v8 chart endpoints.

## Layout

```
data/historical/
  XAUUSD_15m.parquet    # Gold spot — single-asset (no symbol column)
  XAUUSD_30m.parquet
  BURSA_15m.parquet     # Multi-symbol: symbol, timestamp, open, high, low, close, volume
  BURSA_30m.parquet
  NASDAQ_15m.parquet
  NASDAQ_30m.parquet
```

## Build / refresh cache

```bash
npm run ingest:historical
```

This fetches the latest **60 days** of 15m/30m bars (Yahoo intraday API limit) and writes Parquet files for:

- **XAUUSD** — `XAUUSD=X`
- **BURSA** — `1155.KL` (Maybank sample)
- **NASDAQ** — `QQQ`

Extend `scripts/ingest-historical-parquet.mjs` to add more symbols to the BURSA/NASDAQ files.

## Query (server)

DuckDB SQL (see `lib/quant/historical-cache.ts`):

```sql
SELECT timestamp, open, high, low, close, volume
FROM read_parquet('data/historical/XAUUSD_15m.parquet')
WHERE timestamp >= CAST(? AS TIMESTAMP)
  AND timestamp <= CAST(? AS TIMESTAMP)
ORDER BY timestamp
```
