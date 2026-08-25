import type { GlobalTickerKind } from "./types";

export type GlobalTickerSpec = {
  id: string;
  label: string;
  tv: string;
  symbol: string;
  unit: string;
  kind: GlobalTickerKind;
};

/**
 * Native Global Economy tape. `tv` is the TradingView websocket symbol;
 * `symbol` is the compact print on the card.
 *
 * CBOT:US10Y is locked on the public quote stream (empty `qsd`). TVC:US10Y
 * is the live 10-year yield print (already in percent, e.g. 4.71).
 */
export const GLOBAL_TICKER_SPECS: readonly GlobalTickerSpec[] = [
  {
    id: "us10y",
    label: "US 10-YEAR YIELD",
    tv: "TVC:US10Y",
    symbol: "US10Y",
    unit: "%",
    kind: "yield",
  },
  {
    id: "spx",
    label: "S&P 500",
    tv: "FOREXCOM:SPXUSD",
    symbol: "SPX",
    unit: "IDX",
    kind: "index",
  },
  {
    id: "ndx",
    label: "NASDAQ 100",
    tv: "FOREXCOM:NSXUSD",
    symbol: "NDX",
    unit: "IDX",
    kind: "index",
  },
  {
    id: "brent",
    label: "BRENT CRUDE",
    tv: "TVC:UKOIL",
    symbol: "UKOIL",
    unit: "USD/BBL",
    kind: "commodity",
  },
  {
    id: "gold",
    label: "GOLD",
    tv: "TVC:GOLD",
    symbol: "GOLD",
    unit: "USD/OZ",
    kind: "commodity",
  },
];

export function tickerSpecByTv(symbol: string): GlobalTickerSpec | undefined {
  return GLOBAL_TICKER_SPECS.find((spec) => spec.tv === symbol);
}
