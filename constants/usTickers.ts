import usTickerRows from "@/data/us-tickers.json";
import type { QuantAsset } from "@/lib/quant/asset-catalog";

export type UsStockExchange = "NASDAQ" | "NYSE" | "S&P 500";

export interface StockTicker {
  symbol: string;
  name: string;
  exchange: UsStockExchange;
}

const GLOBAL_BENCHMARK = {
  benchmarkSymbol: "^GSPC",
  benchmarkLabel: "S&P 500",
  referenceSymbol: "QQQ",
  referenceLabel: "Nasdaq 100",
} as const;

export const US_TICKERS: readonly StockTicker[] = usTickerRows as StockTicker[];

export const US_TICKER_SYMBOL_SET = new Set(US_TICKERS.map((row) => row.symbol));

const US_TICKER_BY_SYMBOL = new Map(US_TICKERS.map((row) => [row.symbol, row]));

export function getUsTickerCount(): number {
  return US_TICKERS.length;
}

export function isUsTickerSymbol(symbol: string): boolean {
  return US_TICKER_SYMBOL_SET.has(symbol.trim().toUpperCase());
}

export function resolveUsTicker(symbol: string): StockTicker | undefined {
  return US_TICKER_BY_SYMBOL.get(symbol.trim().toUpperCase());
}

export function usTickerToQuantAsset(ticker: StockTicker): QuantAsset {
  return {
    symbol: ticker.symbol,
    label: ticker.name,
    category: "global",
    currency: "USD",
    sector: ticker.exchange,
    ...GLOBAL_BENCHMARK,
  };
}

export function usTickersToQuantAssets(): QuantAsset[] {
  return US_TICKERS.map(usTickerToQuantAsset);
}

export function formatUsTickerLabel(ticker: StockTicker): string {
  return `${ticker.name} (${ticker.symbol})`;
}

export function exchangeBadgeLabel(exchange: UsStockExchange): string {
  return exchange;
}
