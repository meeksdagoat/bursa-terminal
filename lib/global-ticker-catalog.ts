import type { GlobalTickerKind } from "./types";

export type GlobalTickerSpec = {
  id: string;
  label: string;
  yahoo: string;
  symbol: string;
  unit: string;
  kind: GlobalTickerKind;
};

/**
 * Native Global Economy tape. Yahoo symbols are the live feed; `symbol` is the
 * terminal print (US10Y / SPX / NDX) so the cards never show vendor-locked TNX.
 */
export const GLOBAL_TICKER_SPECS: readonly GlobalTickerSpec[] = [
  {
    id: "us10y",
    label: "US 10-YEAR YIELD",
    yahoo: "^TNX",
    symbol: "US10Y",
    unit: "%",
    kind: "yield",
  },
  {
    id: "spx",
    label: "S&P 500",
    yahoo: "^GSPC",
    symbol: "SPX",
    unit: "IDX",
    kind: "index",
  },
  {
    id: "ndx",
    label: "NASDAQ 100",
    yahoo: "^NDX",
    symbol: "NDX",
    unit: "IDX",
    kind: "index",
  },
  {
    id: "brent",
    label: "BRENT CRUDE",
    yahoo: "BZ=F",
    symbol: "BZ=F",
    unit: "USD/BBL",
    kind: "commodity",
  },
  {
    id: "gold",
    label: "GOLD",
    yahoo: "GC=F",
    symbol: "GC=F",
    unit: "USD/OZ",
    kind: "commodity",
  },
];
