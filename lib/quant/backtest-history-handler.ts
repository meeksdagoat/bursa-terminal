import type { NextRequest } from "next/server";

import { cached } from "@/lib/cache";
import { computeAssetBuyAndHold } from "@/lib/quant/asset-buy-and-hold";
import { fetchBacktestHistory, buildMarketDataUnavailableMessage } from "@/lib/quant/fetch-backtest-bars";
import {
  coerceLookbackForTimeframe,
  defaultLookbackForTimeframe,
  isBacktestLookbackOptionId,
  isBacktestTimeframe,
  resolveBacktestFetchRange,
  type BacktestLookbackOptionId,
  type BacktestTimeframe,
} from "@/lib/quant/backtest-timeframe";
import { isQuantHubSymbol } from "@/lib/quant/asset-catalog";
import { isUsTickerSymbol } from "@/constants/usTickers";
import { isTrackedSymbol } from "@/lib/universe";
import type { BacktestHistoryPayload } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000;
const DEFAULT_INITIAL_CAPITAL = 10_000;

function isAllowedSymbol(symbol: string): boolean {
  const trimmed = symbol.trim();
  if (!trimmed) return false;

  const benchmarkAllowlist = new Set([
    "^KLSE",
    "^GSPC",
    "QQQ",
    "GC=F",
    "XAUUSD=X",
    "BZ=F",
    "CL=F",
    "USDMYR=X",
    "BTC-USD",
    "SI=F",
    "GLD",
    "SLV",
  ]);

  return (
    isTrackedSymbol(trimmed) ||
    benchmarkAllowlist.has(trimmed) ||
    isQuantHubSymbol(trimmed) ||
    isUsTickerSymbol(trimmed)
  );
}

function parseDateParam(raw: string | null, fallback: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallback;
}

function parseLookbackOption(
  raw: string | null,
  timeframe: BacktestTimeframe,
): BacktestLookbackOptionId {
  if (isBacktestLookbackOptionId(raw)) {
    return coerceLookbackForTimeframe(timeframe, raw);
  }

  if (raw === "3y" || raw === "5y") {
    return coerceLookbackForTimeframe(timeframe, raw);
  }

  return defaultLookbackForTimeframe(timeframe);
}

function parseInitialCapital(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_INITIAL_CAPITAL;
  return parsed;
}

function withAssetBuyAndHold(
  payload: BacktestHistoryPayload,
  input: { timeframe: BacktestTimeframe; initialCapital: number },
): BacktestHistoryPayload {
  const { curve, returnPct } = computeAssetBuyAndHold({
    bars: payload.bars,
    timeframe: input.timeframe,
    initialCapital: input.initialCapital,
  });

  return {
    ...payload,
    assetBuyAndHold: curve,
    assetHoldReturn: returnPct,
  };
}

export async function handleBacktestHistoryGet(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "").trim();
  const timeframeRaw = searchParams.get("timeframe") ?? "1D";
  const lookbackRaw = searchParams.get("lookback");
  const initialCapital = parseInitialCapital(searchParams.get("initialCapital"));

  if (!symbol) {
    return Response.json({ error: "Missing symbol parameter" }, { status: 400 });
  }

  if (!isAllowedSymbol(symbol)) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }

  const timeframe: BacktestTimeframe = isBacktestTimeframe(timeframeRaw) ? timeframeRaw : "1D";
  const lookbackOption = parseLookbackOption(lookbackRaw, timeframe);
  const fetchRange = resolveBacktestFetchRange({ lookbackOption, timeframe });
  const from = parseDateParam(searchParams.get("from"), fetchRange.from);
  const to = parseDateParam(searchParams.get("to"), fetchRange.to);

  const cacheKey = `backtest-history:${symbol}:${timeframe}:${lookbackOption}:${from}:${to}`;

  try {
    const payload = await cached(cacheKey, TTL_MS, () =>
      fetchBacktestHistory({ symbol, timeframe, from, to, lookbackOption }),
    );

    const enriched = withAssetBuyAndHold(payload, { timeframe, initialCapital });

    return Response.json(enriched satisfies BacktestHistoryPayload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    const empty: BacktestHistoryPayload = {
      source: "yahoo",
      symbol,
      timeframe,
      from,
      to,
      asOf: new Date().toISOString(),
      bars: [],
      truncated: false,
      warning: buildMarketDataUnavailableMessage({ symbol, lookbackOption }),
      assetBuyAndHold: [],
      assetHoldReturn: null,
    };

    return Response.json(empty, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
