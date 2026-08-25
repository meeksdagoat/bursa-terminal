import "server-only";

import { GLOBAL_TICKER_SPECS } from "./global-ticker-catalog";
import type { GlobalTickerQuote, GlobalTickersPayload } from "./types";
import { fetchQuotes } from "./yahoo";

function tnxYield(price: number | null): number | null {
  if (price == null || !Number.isFinite(price)) return null;
  return price > 20 ? price / 10 : price;
}

export async function getGlobalTickers(): Promise<GlobalTickersPayload> {
  const errors: string[] = [];
  const empty: GlobalTickerQuote[] = GLOBAL_TICKER_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    symbol: spec.symbol,
    unit: spec.unit,
    kind: spec.kind,
    price: null,
    changePct: null,
    currency: null,
    asOf: null,
  }));

  try {
    const quotes = await fetchQuotes(GLOBAL_TICKER_SPECS.map((spec) => spec.yahoo));
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const tickers = GLOBAL_TICKER_SPECS.map((spec) => {
      const quote = bySymbol.get(spec.yahoo);
      const raw = quote?.price ?? null;
      const price = spec.kind === "yield" ? tnxYield(raw) : raw;
      return {
        id: spec.id,
        label: spec.label,
        symbol: spec.symbol,
        unit: spec.unit,
        kind: spec.kind,
        price,
        changePct: quote?.changePct ?? null,
        currency: quote?.currency ?? null,
        asOf: quote?.quoteTime ?? null,
      } satisfies GlobalTickerQuote;
    });

    return {
      source: "yahoo",
      asOf: new Date().toISOString(),
      tickers,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      source: "yahoo",
      asOf: new Date().toISOString(),
      tickers: empty,
      errors,
    };
  }
}
