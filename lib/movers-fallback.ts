import type { MoverRow, MoversPayload, Quote, UniverseEntry } from "./types";
import { entryBySymbol, universe } from "./universe";

/**
 * Static last-session board used when Yahoo is down or the live tape is empty.
 * Prices are indicative liquid-name levels, not a live print.
 */
const FALLBACK_SEEDS: Array<{
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
}> = [
  { symbol: "0166.KL", price: 2.26, changePct: 1.8, volume: 12_400_000 },
  { symbol: "6012.KL", price: 3.81, changePct: 0.79, volume: 8_100_000 },
  { symbol: "1155.KL", price: 10.56, changePct: 0.38, volume: 18_200_000 },
  { symbol: "1023.KL", price: 7.96, changePct: 0.25, volume: 9_400_000 },
  { symbol: "8869.KL", price: 6.42, changePct: 0.47, volume: 5_200_000 },
  { symbol: "5225.KL", price: 8.12, changePct: 0.25, volume: 3_100_000 },
  { symbol: "3182.KL", price: 2.08, changePct: -0.95, volume: 14_600_000 },
  { symbol: "5347.KL", price: 14.3, changePct: -0.69, volume: 7_800_000 },
  { symbol: "5183.KL", price: 4.35, changePct: -0.46, volume: 4_200_000 },
  { symbol: "6888.KL", price: 2.45, changePct: -0.41, volume: 6_500_000 },
  { symbol: "1295.KL", price: 5.1, changePct: -0.2, volume: 11_000_000 },
  { symbol: "2445.KL", price: 20.5, changePct: -0.34, volume: 1_200_000 },
];

function quoteFor(entry: UniverseEntry, price: number, changePct: number, volume: number): Quote {
  const change = price * (changePct / 100);
  return {
    symbol: entry.symbol,
    name: entry.name,
    price,
    change,
    changePct,
    previousClose: price - change,
    dayHigh: null,
    dayLow: null,
    yearHigh: null,
    yearLow: null,
    volume,
    pe: null,
    marketCap: null,
    dividendYieldPct: null,
    currency: "MYR",
    marketState: "CLOSED",
    delayMinutes: 15,
    quoteTime: null,
  };
}

function toRow(seed: (typeof FALLBACK_SEEDS)[number]): MoverRow | null {
  const entry = entryBySymbol(seed.symbol);
  if (!entry) return null;
  return { ...entry, quote: quoteFor(entry, seed.price, seed.changePct, seed.volume) };
}

export function fallbackMoversPayload(
  errors: string[] = [],
  index: Quote | null = null,
): MoversPayload {
  const rows = FALLBACK_SEEDS.flatMap((seed) => {
    const row = toRow(seed);
    return row ? [row] : [];
  });
  const ranked = [...rows].sort((a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0));
  const gainers = ranked.filter((row) => (row.quote.changePct ?? 0) > 0).slice(0, 6);
  const losers = ranked
    .filter((row) => (row.quote.changePct ?? 0) < 0)
    .slice(-6)
    .reverse();

  return {
    source: "fallback",
    asOf: new Date().toISOString(),
    delayMinutes: 15,
    marketState: "CLOSED",
    index,
    gainers,
    losers,
    breadth: {
      advancers: gainers.length,
      decliners: losers.length,
      unchanged: 0,
      covered: rows.length,
      universe: universe.length,
    },
    errors:
      errors.length > 0
        ? errors
        : ["Live tape idle — showing last-session board"],
    lastSession: true,
  };
}

export function resolveMoversBoard(payload: MoversPayload | null): MoversPayload {
  if (!payload) return fallbackMoversPayload();
  if (payload.gainers.length === 0 && payload.losers.length === 0) {
    return fallbackMoversPayload(payload.errors, payload.index);
  }
  return payload;
}
