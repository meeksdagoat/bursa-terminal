/** Client-safe commodity/FX ticker normalization for Yahoo Finance history fetches. */

import { COMMODITY_QUANT_ASSETS } from "@/constants/quantAssets";
import { resolveQuantAsset } from "@/lib/quant/asset-catalog";

export const HISTORY_WARMUP_CALENDAR_DAYS = 90;

const COMMODITY_SYMBOLS = new Set(COMMODITY_QUANT_ASSETS.map((asset) => asset.symbol));

function tokenKey(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9=]/g, "");
}

/** Map spot/alias tickers to liquid Yahoo futures or ETF symbols (daily+ history). */
export function normalizeYahooSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  const key = tokenKey(symbol);

  if (
    key === "XAUUSD" ||
    key === "XAUUSDX" ||
    raw === "XAUUSD=X" ||
    key === "GOLD" ||
    key === "XAU" ||
    raw === "XAU/USD"
  ) {
    return "GC=F";
  }

  if (key === "BRENT" || key === "UKOIL" || key === "CRUDE" || raw === "BRENT CRUDE") {
    return "BZ=F";
  }

  if (
    key === "SILVER" ||
    key === "XAGUSD" ||
    key === "XAGUSDX" ||
    raw === "XAGUSD=X" ||
    key === "XAG" ||
    raw === "XAG/USD"
  ) {
    return "SI=F";
  }

  if (key === "WTI" || key === "WTICRUDE") {
    return "CL=F";
  }

  return raw;
}

/** Ordered Yahoo symbols to try (primary mapped futures/ETF first). */
export function yahooFetchCandidates(requestedSymbol: string): string[] {
  const key = tokenKey(requestedSymbol);

  if (
    key === "XAUUSD" ||
    key === "XAUUSDX" ||
    requestedSymbol.toUpperCase() === "XAUUSD=X" ||
    key === "GOLD" ||
    key === "XAU"
  ) {
    return ["GC=F", "GLD"];
  }

  if (key === "BRENT" || key === "UKOIL" || key === "CRUDE") {
    return ["BZ=F", "CL=F"];
  }

  if (key === "SILVER" || key === "XAGUSD" || key === "XAGUSDX" || key === "XAG") {
    return ["SI=F", "SLV"];
  }

  const normalized = normalizeYahooSymbol(requestedSymbol);
  if (normalized !== requestedSymbol.trim().toUpperCase()) {
    return [normalized, requestedSymbol.trim().toUpperCase()];
  }

  return [requestedSymbol.trim().toUpperCase()];
}

/** Ensure forex/FX tickers use Yahoo's `=X` suffix (e.g. XAUUSD=X). */
export function toYahooFxSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (raw.endsWith("=X")) return raw;
  if (raw.startsWith("C:") && !raw.includes(".")) {
    return `${raw.slice(2)}=X`;
  }
  return raw;
}

/** Strip Yahoo FX suffix (e.g. XAUUSD=X → XAUUSD). */
export function stripYahooFxSuffix(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (raw.endsWith("=X")) return raw.slice(0, -2);
  return raw;
}

/** Ordered Yahoo symbols for intraday backtest history (direct FX pair before futures mapping). */
export function yahooBacktestFetchCandidates(
  requestedSymbol: string,
  intraday: boolean,
): string[] {
  const raw = requestedSymbol.trim().toUpperCase();
  const candidates: string[] = [];

  if (intraday) {
    const fxDirect = toYahooFxSymbol(raw);
    if (fxDirect.endsWith("=X")) {
      candidates.push(fxDirect);
    }
  }

  for (const candidate of yahooFetchCandidates(requestedSymbol)) {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  if (!candidates.includes(raw)) {
    candidates.push(raw);
  }

  return candidates;
}

export function isQuantCommoditySymbol(symbol: string): boolean {
  const asset = resolveQuantAsset(symbol);
  if (asset?.category === "commodity") return true;
  return COMMODITY_SYMBOLS.has(symbol.trim().toUpperCase());
}

export function historyFetchPeriod1(requestedFrom: Date): Date {
  return new Date(
    requestedFrom.getTime() - HISTORY_WARMUP_CALENDAR_DAYS * 86_400_000,
  );
}

export type DailyClosePoint = {
  time: number;
  close: number;
};

function isWeekday(unixSeconds: number): boolean {
  const day = new Date(unixSeconds * 1000).getUTCDay();
  return day !== 0 && day !== 6;
}

/** Drop invalid bars, sort ascending, forward-fill weekday gaps. */
export function cleanAndForwardFillDailyCloses(
  points: DailyClosePoint[],
): DailyClosePoint[] {
  const sorted = points
    .filter(
      (point) =>
        Number.isFinite(point.time) &&
        Number.isFinite(point.close) &&
        point.close > 0,
    )
    .sort((left, right) => left.time - right.time);

  if (sorted.length <= 1) return sorted;

  const filled: DailyClosePoint[] = [sorted[0]!];
  let previous = sorted[0]!;

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    let cursor = previous.time + 86_400;

    while (cursor < current.time) {
      if (isWeekday(cursor)) {
        filled.push({ time: cursor, close: previous.close });
      }
      cursor += 86_400;
    }

    filled.push(current);
    previous = current;
  }

  return filled;
}
