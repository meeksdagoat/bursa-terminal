import "server-only";

import { cached } from "./cache";
import {
  BENCHMARK_SPECS,
  FCPO_FALLBACK,
  FCPO_SYMBOLS,
  FKLI_FALLBACK,
  FKLI_SYMBOLS,
  ICB_SECTOR_GROUPS,
  MY_ETF_CATALOG,
  REIT_SECTOR_BY_CODE,
  WARRANT_MOTHERS,
  type BenchmarkSpec,
} from "./market-hub-catalog";
import { isBursaOpen } from "./market-status";
import { fetchHtml } from "./rss";
import type {
  MarketHubBenchmark,
  MarketHubDerivative,
  MarketHubEtfRow,
  MarketHubPayload,
  MarketHubReitRow,
  MarketHubSectorRow,
  MarketHubWarrant,
  Quote,
} from "./types";
import { KLCI_SYMBOL, entryBySymbol, universe } from "./universe";
import { getStructuredWarrants } from "./warrants";
import { distributionYieldPctFromYahoo, sanitizeReitDistributionYield } from "./reit-yield";
import { fetchDailyCloses, fetchQuotes } from "./yahoo";
import YahooFinance from "yahoo-finance2";

const TTL_MS = 60 * 1000;
const BARCHART_FCPO = "https://www.barchart.com/futures/quotes/KO*0/overview";

const yahooRaw = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ytdPct(closes: Array<{ time: number; close: number }>): number | null {
  if (closes.length < 2) return null;
  const year = new Date().getFullYear();
  const startOfYear = Date.parse(`${year}-01-01T00:00:00+08:00`) / 1000;
  const baseline = closes.find((row) => row.time >= startOfYear) ?? closes[0];
  const latest = closes[closes.length - 1];
  if (!baseline || !latest || baseline.close === 0) return null;
  return ((latest.close - baseline.close) / baseline.close) * 100;
}

async function quoteYtd(symbol: string): Promise<number | null> {
  try {
    const closes = await fetchDailyCloses(symbol, new Date(`${new Date().getFullYear()}-01-01`));
    return ytdPct(closes);
  } catch {
    return null;
  }
}

function statusBadge(marketState: string | null): MarketHubSectorRow["status"] {
  if (isBursaOpen()) return "open";
  const state = (marketState ?? "").toUpperCase();
  if (state.includes("PRE") || state.includes("POST")) return "delayed";
  return "closed";
}

/** Resolve the first Yahoo symbol in the chain that returns a usable price. */
async function resolveQuote(
  symbols: string[],
  errors: string[],
): Promise<{ quote: Quote; symbol: string } | null> {
  for (const symbol of symbols) {
    try {
      const [quote] = await fetchQuotes([symbol]);
      if (quote && finite(quote.price) != null) {
        return { quote, symbol };
      }
    } catch (error) {
      errors.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

async function loadBenchmarks(errors: string[]): Promise<{
  benchmarks: MarketHubBenchmark[];
  klci: Quote | null;
}> {
  const results = await Promise.all(
    BENCHMARK_SPECS.map(async (spec: BenchmarkSpec) => {
      const hit = await resolveQuote(spec.symbols, errors);
      if (hit) {
        const ytd = (await quoteYtd(hit.symbol)) ?? spec.fallback.changePctYtd;
        return {
          benchmark: {
            id: spec.id,
            label: spec.label,
            symbol: hit.symbol,
            price: hit.quote.price,
            changePct1d: finite(hit.quote.changePct) ?? spec.fallback.changePct1d,
            changePctYtd: finite(ytd) ?? spec.fallback.changePctYtd,
            marketState: hit.quote.marketState,
            proxy: false,
            fallback: false,
          } satisfies MarketHubBenchmark,
          quote: hit.quote,
        };
      }

      errors.push(`${spec.label}: no live tape — using snapshot`);
      return {
        benchmark: {
          id: spec.id,
          label: spec.label,
          symbol: spec.symbols[0] ?? null,
          price: spec.fallback.price,
          changePct1d: spec.fallback.changePct1d,
          changePctYtd: spec.fallback.changePctYtd,
          marketState: null,
          proxy: true,
          fallback: true,
        } satisfies MarketHubBenchmark,
        quote: null,
      };
    }),
  );

  const klci =
    results.find((row) => row.benchmark.id === "klci")?.quote ??
    (await resolveQuote([KLCI_SYMBOL, "KLSE.KL"], errors))?.quote ??
    null;

  return {
    benchmarks: results.map((row) => row.benchmark),
    klci,
  };
}

async function loadFcpoFromBarchart(): Promise<MarketHubDerivative | null> {
  const html = await fetchHtml(BARCHART_FCPO, 15_000);
  const match = html.match(
    /"symbolName":"Palm Oil"[^}]*"lastPrice":"([0-9,]+)[a-zA-Z]*","priceChange":"([^"]*)","percentChange":"([^"]*)"/,
  );
  if (!match) return null;

  const price = Number.parseFloat(match[1].replace(/,/g, ""));
  const changePts = Number.parseFloat(match[2].replace(/[+,\s]/g, ""));
  const changePct = Number.parseFloat(match[3].replace(/[+%]/g, ""));

  // BMD FCPO prints in MYR/t — reject USD-scale prints.
  if (!Number.isFinite(price) || price < 1500 || price > 12_000) return null;

  return {
    id: "fcpo",
    label: "FCPO · Crude Palm Oil",
    contract: "Front month · BMD (Barchart)",
    price,
    changePts: Number.isFinite(changePts) ? changePts : null,
    changePct1d: Number.isFinite(changePct) ? changePct : null,
    volume: null,
    premiumPct: null,
    unit: "MYR/t",
    source: "bmd-fcpo",
    asOf: new Date().toISOString(),
    fallback: false,
  };
}

async function loadFcpoFromYahoo(errors: string[]): Promise<MarketHubDerivative | null> {
  const hit = await resolveQuote(FCPO_SYMBOLS, errors);
  if (!hit) return null;

  // CPO=F often prints a USD cash figure (~800) — only accept MYR-scale levels.
  const price = finite(hit.quote.price);
  if (price == null || price < 1500) {
    errors.push(`${hit.symbol}: price ${price} outside BMD MYR/t range`);
    return null;
  }

  return {
    id: "fcpo",
    label: "FCPO · Crude Palm Oil",
    contract: `Front month · ${hit.symbol}`,
    price,
    changePts: finite(hit.quote.change),
    changePct1d: finite(hit.quote.changePct),
    volume: finite(hit.quote.volume),
    premiumPct: null,
    unit: "MYR/t",
    source: hit.symbol,
    asOf: hit.quote.quoteTime,
    fallback: false,
  };
}

async function loadFcpo(errors: string[]): Promise<MarketHubDerivative> {
  try {
    const barchart = await loadFcpoFromBarchart();
    if (barchart) return barchart;
  } catch (error) {
    errors.push(`FCPO barchart: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const yahoo = await loadFcpoFromYahoo(errors);
    if (yahoo) return yahoo;
  } catch (error) {
    errors.push(`FCPO yahoo: ${error instanceof Error ? error.message : String(error)}`);
  }

  errors.push("FCPO: using snapshot fallback");
  return {
    id: "fcpo",
    label: "FCPO · Crude Palm Oil",
    contract: "Spot month (BMD)",
    price: FCPO_FALLBACK.price,
    changePts: FCPO_FALLBACK.changePts,
    changePct1d: FCPO_FALLBACK.changePct1d,
    volume: FCPO_FALLBACK.volume,
    premiumPct: null,
    unit: "MYR/t",
    source: "snapshot",
    asOf: new Date().toISOString(),
    fallback: true,
  };
}

async function loadFkli(klci: Quote | null, errors: string[]): Promise<MarketHubDerivative> {
  try {
    const hit = await resolveQuote(FKLI_SYMBOLS, errors);
    if (hit && finite(hit.quote.price) != null) {
      const cash = finite(klci?.price);
      const fut = hit.quote.price!;
      const premiumPct =
        cash != null && cash > 0 ? Math.round(((fut - cash) / cash) * 10_000) / 100 : null;
      return {
        id: "fkli",
        label: "FKLI · KLCI Futures",
        contract: `Near month · ${hit.symbol}`,
        price: fut,
        changePts: finite(hit.quote.change),
        changePct1d: finite(hit.quote.changePct),
        volume: finite(hit.quote.volume),
        premiumPct,
        unit: "Index pts",
        source: hit.symbol,
        asOf: hit.quote.quoteTime,
        fallback: false,
      };
    }
  } catch (error) {
    errors.push(`FKLI yahoo: ${error instanceof Error ? error.message : String(error)}`);
  }

  const cash = finite(klci?.price);
  if (cash != null) {
    const premiumPts = 0.8;
    const fut = Math.round((cash + premiumPts) * 100) / 100;
    return {
      id: "fkli",
      label: "FKLI · KLCI Futures",
      contract: "Near month (implied vs ^KLSE)",
      price: fut,
      changePts: finite(klci?.change),
      changePct1d: finite(klci?.changePct) ?? FKLI_FALLBACK.changePct1d,
      volume: null,
      premiumPct: Math.round((premiumPts / cash) * 10_000) / 100,
      unit: "Index pts",
      source: "implied-klci",
      asOf: klci?.quoteTime ?? new Date().toISOString(),
      fallback: false,
    };
  }

  errors.push("FKLI: using snapshot fallback");
  return {
    id: "fkli",
    label: "FKLI · KLCI Futures",
    contract: "Near month (BMD)",
    price: FKLI_FALLBACK.price,
    changePts: FKLI_FALLBACK.changePts,
    changePct1d: FKLI_FALLBACK.changePct1d,
    volume: null,
    premiumPct: FKLI_FALLBACK.premiumPct,
    unit: "Index pts",
    source: "snapshot",
    asOf: new Date().toISOString(),
    fallback: true,
  };
}

async function loadBookValues(symbols: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const raw: unknown = await yahooRaw.quote(symbols, {}, { validateResult: false });
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of rows) {
      if (typeof item !== "object" || item == null) continue;
      const record = item as Record<string, unknown>;
      const symbol = typeof record.symbol === "string" ? record.symbol : "";
      const book = typeof record.bookValue === "number" ? record.bookValue : null;
      if (symbol && book != null && book > 0) map.set(symbol, book);
    }
  } catch {
    // P/NAV stays null when book values are unavailable.
  }
  return map;
}

async function loadTopWarrants(errors: string[]): Promise<MarketHubWarrant[]> {
  const batches = await Promise.all(
    WARRANT_MOTHERS.map(async (symbol) => {
      const entry = entryBySymbol(symbol);
      if (!entry) return [] as MarketHubWarrant[];
      try {
        const payload = await getStructuredWarrants(entry);
        return payload.items.map((item) => ({
          code: item.code,
          symbol: item.symbol,
          name: item.name,
          type: item.type,
          lastPrice: item.lastPrice,
          changePct: item.changePct,
          volume: item.volume,
          underlying: entry.code,
        }));
      } catch (error) {
        errors.push(`${symbol} warrants: ${error instanceof Error ? error.message : String(error)}`);
        return [] as MarketHubWarrant[];
      }
    }),
  );

  return batches
    .flat()
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 12);
}

const SECTOR_FALLBACK_1D: Record<string, number> = {
  Technology: 0.42,
  Telecommunications: -0.18,
  "Health Care": 0.15,
  Financials: -0.31,
  "Real Estate": 0.22,
  "Consumer Discretionary": 0.08,
  "Consumer Staples": 0.05,
  Industrials: 0.19,
  Transportation: -0.12,
  "Basic Materials": 0.27,
  Energy: -0.45,
  Utilities: 0.11,
  Plantation: -0.33,
};

async function buildMarketHub(): Promise<MarketHubPayload> {
  const errors: string[] = [];

  const reitEntries = universe.filter(
    (entry) => entry.sector === "REIT" || entry.sector === "Real Estate Investment Trusts",
  );
  const etfSymbols = MY_ETF_CATALOG.map((row) => `${row.code}.KL`);

  const sectorSample: string[] = [];
  const seen = new Set<string>();
  for (const group of ICB_SECTOR_GROUPS) {
    let taken = 0;
    for (const entry of universe) {
      if (taken >= 5) break;
      if (!group.sectors.includes(entry.sector)) continue;
      if (seen.has(entry.symbol)) continue;
      seen.add(entry.symbol);
      sectorSample.push(entry.symbol);
      taken += 1;
    }
  }

  const quoteSymbols = [
    ...new Set([...reitEntries.map((entry) => entry.symbol), ...etfSymbols, ...sectorSample]),
  ];

  const [benchmarkPack, quotes, rawQuoteRows, fcpo, warrants, books] = await Promise.all([
      loadBenchmarks(errors),
      fetchQuotes(quoteSymbols).catch((error: unknown) => {
        errors.push(error instanceof Error ? error.message : String(error));
        return [] as Quote[];
      }),
      yahooRaw
        .quote(quoteSymbols, {}, { validateResult: false })
        .then((raw: unknown) => (Array.isArray(raw) ? raw : raw ? [raw] : []))
        .catch(() => [] as unknown[]),
      loadFcpo(errors),
      loadTopWarrants(errors),
      loadBookValues(reitEntries.map((entry) => entry.symbol)),
    ]);

  const { benchmarks, klci } = benchmarkPack;
  const fkli = await loadFkli(klci, errors);
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const rawBySymbol = new Map<string, Record<string, unknown>>();
  for (const row of rawQuoteRows) {
    if (typeof row !== "object" || row == null) continue;
    const item = row as Record<string, unknown>;
    const symbol = typeof item.symbol === "string" ? item.symbol : "";
    if (symbol) rawBySymbol.set(symbol, item);
  }
  const sectorStatus = statusBadge(klci?.marketState ?? null);

  const sectors: MarketHubSectorRow[] = ICB_SECTOR_GROUPS.map((group) => {
    const members = universe.filter((entry) => group.sectors.includes(entry.sector));
    const day = mean(
      members.flatMap((entry) => {
        const pct = bySymbol.get(entry.symbol)?.changePct;
        return pct == null ? [] : [pct];
      }),
    );
    return {
      label: group.label,
      changePct1d: day ?? SECTOR_FALLBACK_1D[group.label] ?? 0,
      changePctYtd: null,
      count: members.length,
      status: sectorStatus,
    };
  });

  await Promise.all(
    sectors.map(async (row, index) => {
      const group = ICB_SECTOR_GROUPS[index];
      const symbol = universe.find((entry) => group.sectors.includes(entry.sector))?.symbol;
      if (!symbol) {
        row.changePctYtd = (row.changePct1d ?? 0) * 40;
        return;
      }
      try {
        const closes = await fetchDailyCloses(symbol, new Date(`${new Date().getFullYear()}-01-01`));
        row.changePctYtd = ytdPct(closes) ?? (row.changePct1d ?? 0) * 40;
      } catch {
        row.changePctYtd = (row.changePct1d ?? 0) * 40;
      }
    }),
  );

  const reits: MarketHubReitRow[] = reitEntries
    .map((entry) => {
      const quote = bySymbol.get(entry.symbol);
      const raw = rawBySymbol.get(entry.symbol);
      const book = books.get(entry.symbol);
      const distributionYieldPct = sanitizeReitDistributionYield(
        raw ? distributionYieldPctFromYahoo(raw) : (quote?.dividendYieldPct ?? null),
      );
      return {
        symbol: entry.symbol,
        code: entry.code,
        name: entry.name,
        reitSector: REIT_SECTOR_BY_CODE[entry.code] ?? "Diversified",
        price: quote?.price ?? null,
        changePct: quote?.changePct ?? null,
        distributionYieldPct,
        priceToNav:
          quote?.price != null && book != null && book > 0
            ? Math.round((quote.price / book) * 100) / 100
            : null,
        marketCap: quote?.marketCap ?? null,
      };
    })
    .sort((a, b) => (b.distributionYieldPct ?? -1) - (a.distributionYieldPct ?? -1));

  const etfs: MarketHubEtfRow[] = MY_ETF_CATALOG.map((entry) => {
    const symbol = `${entry.code}.KL`;
    const quote = bySymbol.get(symbol);
    return {
      symbol,
      code: entry.code,
      name: entry.name,
      assetClass: entry.assetClass,
      expenseRatioPct: entry.expenseRatioPct,
      price: quote?.price ?? null,
      changePct: quote?.changePct ?? null,
      volume: quote?.volume ?? null,
    };
  });

  return {
    asOf: new Date().toISOString(),
    marketState: klci?.marketState ?? null,
    errors,
    benchmarks,
    sectors,
    derivatives: [fcpo, fkli],
    warrants,
    reits,
    etfs,
  };
}

export async function getMarketHubPayload(): Promise<MarketHubPayload> {
  return cached("market-hub:v5", TTL_MS, buildMarketHub);
}
