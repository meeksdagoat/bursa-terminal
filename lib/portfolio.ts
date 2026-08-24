import type { DailyClose } from "./types";

/** Client-safe portfolio types, period windows and P&L maths. */

export const PORTFOLIO_RANGES = ["1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;

export type PortfolioRange = (typeof PORTFOLIO_RANGES)[number];

export type Holding = {
  id: string;
  symbol: string;
  quantity: number;
  /** Average price paid per share, in MYR. */
  costPerShare: number;
  /** Calendar day the lot was bought, `YYYY-MM-DD` in KL time. */
  boughtAt: string;
};

export type TradeType = "buy" | "sell";

export type Transaction = {
  id: string;
  symbol: string;
  type: TradeType;
  quantity: number;
  price: number;
  fees: number;
  /** Calendar day of the fill, `YYYY-MM-DD` in KL time. */
  date: string;
  /** Realised P&L on sells; null on buys. */
  realizedPnl: number | null;
};

export function klToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year && month && day) return `${year}-${month}-${day}`;
  return new Date().toISOString().slice(0, 10);
}

/** Native `<input type="date">` only accepts `YYYY-MM-DD`. */
export function toDateInputValue(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return iso[0];

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }

  return klToday();
}

/** Holdings table display; state stays ISO. */
export function formatHoldingDay(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!iso) return value;
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

export function parseHoldingDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const iso = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`);
  return Number.isNaN(iso) ? null : iso;
}

export function rangeStartMs(range: PortfolioRange, holdings: Holding[]): number {
  const now = Date.now();

  if (range === "YTD") {
    const year = klToday().slice(0, 4);
    return parseHoldingDate(`${year}-01-01`) ?? Date.parse(`${year}-01-01T00:00:00+08:00`);
  }

  if (range === "ALL") {
    const stamps = holdings
      .map((holding) => parseHoldingDate(holding.boughtAt))
      .filter((value): value is number => value != null);
    return stamps.length > 0 ? Math.min(...stamps) : now - 20 * 365.25 * 86_400_000;
  }

  const days: Record<Exclude<PortfolioRange, "YTD" | "ALL">, number> = {
    "1M": 31,
    "3M": 93,
    "6M": 186,
    "1Y": 365,
    "5Y": 365 * 5,
  };

  return now - days[range] * 86_400_000;
}

export function historyFromIso(range: PortfolioRange, holdings: Holding[]): string {
  const start = new Date(rangeStartMs(range, holdings));
  // Pad so the first session before the window is still in the series.
  start.setUTCDate(start.getUTCDate() - 10);
  return start.toISOString().slice(0, 10);
}

/** Last close at or before `atMs`; falls back to the first print if the window starts before listing. */
export function closeAt(series: DailyClose[] | undefined, atMs: number): number | null {
  if (!series || series.length === 0) return null;

  let chosen: number | null = null;
  for (const point of series) {
    if (point.time * 1000 <= atMs) chosen = point.close;
    else break;
  }

  return chosen ?? series[0]?.close ?? null;
}

export function weightedAverage(quantity: number, cost: number, addQty: number, addCost: number): number {
  const total = quantity + addQty;
  if (total <= 0) return addCost;
  return (quantity * cost + addQty * addCost) / total;
}

/**
 * Price used as the start of a window: cost if the lot was bought during the
 * window (or for all-time), otherwise the last close at the window open.
 */
export function startPrice(
  holding: Holding,
  range: PortfolioRange,
  windowStart: number,
  series: DailyClose[] | undefined,
): number | null {
  const bought = parseHoldingDate(holding.boughtAt);
  if (range === "ALL" || (bought != null && bought >= windowStart)) {
    return holding.costPerShare;
  }
  return closeAt(series, windowStart) ?? holding.costPerShare;
}

export type ValuePoint = { time: number; value: number };

export function portfolioValueSeries(
  holdings: Holding[],
  series: Record<string, DailyClose[]>,
  windowStart: number,
): ValuePoint[] {
  const times = new Set<number>();
  for (const holding of holdings) {
    for (const point of series[holding.symbol] ?? []) {
      if (point.time * 1000 >= windowStart) times.add(point.time);
    }
  }

  const ordered = [...times].sort((a, b) => a - b);
  const lastClose = new Map<string, number>();
  const bySymbol = new Map(
    holdings.map((holding) => [holding.symbol, series[holding.symbol] ?? []] as const),
  );

  const cursors = new Map<string, number>();
  for (const symbol of bySymbol.keys()) cursors.set(symbol, 0);

  const points: ValuePoint[] = [];

  for (const time of ordered) {
    const atMs = time * 1000;

    for (const [symbol, path] of bySymbol) {
      let index = cursors.get(symbol) ?? 0;
      while (index < path.length && path[index].time <= time) {
        lastClose.set(symbol, path[index].close);
        index += 1;
      }
      cursors.set(symbol, index);
    }

    let value = 0;
    let any = false;
    for (const holding of holdings) {
      const bought = parseHoldingDate(holding.boughtAt);
      if (bought != null && bought > atMs) continue;
      const px = lastClose.get(holding.symbol);
      if (px == null) continue;
      value += holding.quantity * px;
      any = true;
    }

    if (any) points.push({ time, value });
  }

  return points;
}

