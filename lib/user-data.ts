import { toDateInputValue, type Holding, type Transaction } from "./portfolio";
import { DEFAULT_WATCHLIST, entryBySymbol, isTrackedSymbol } from "./universe";

export const PORTFOLIO_STORAGE_KEY = "bursa-terminal:portfolio:v2";
export const PORTFOLIO_STORAGE_V1 = "bursa-terminal:portfolio:v1";
export const WATCHLIST_STORAGE_KEY = "bursa-terminal:watchlist:v1";
/** Keys named in the account-sync spec; still read on first sign-in. */
export const PORTFOLIO_DATA_KEY = "portfolio_data";
export const WATCHLIST_DATA_KEY = "watchlist_data";

export const MAX_HOLDINGS = 40;
export const MAX_WATCHLIST = 60;

export type PortfolioSnapshot = {
  holdings: Holding[];
  transactions: Transaction[];
};

export type UserDataSnapshot = {
  portfolio: PortfolioSnapshot;
  watchlist: string[];
};

export type PortfolioItemDTO = {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
};

export type WatchlistItemDTO = {
  id: string;
  ticker: string;
  companyName: string;
  addedAt: string;
};

export type UserDataResponse = UserDataSnapshot & {
  initialized: boolean;
  portfolioItems: PortfolioItemDTO[];
  watchlistItems: WatchlistItemDTO[];
};

export function companyNameFor(ticker: string): string {
  return entryBySymbol(ticker)?.name ?? ticker;
}

export function holdingToItem(holding: Holding): PortfolioItemDTO {
  return {
    id: holding.id,
    ticker: holding.symbol,
    companyName: companyNameFor(holding.symbol),
    shares: holding.quantity,
    buyPrice: holding.costPerShare,
    buyDate: toDateInputValue(holding.boughtAt),
  };
}

export function itemToHolding(item: PortfolioItemDTO): Holding {
  return {
    id: item.id,
    symbol: item.ticker,
    quantity: item.shares,
    costPerShare: item.buyPrice,
    boughtAt: toDateInputValue(item.buyDate),
  };
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function sanitizePortfolioItems(value: unknown): PortfolioItemDTO[] | null {
  if (!Array.isArray(value)) return null;
  const items: PortfolioItemDTO[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<PortfolioItemDTO> & { symbol?: string; quantity?: number; costPerShare?: number; boughtAt?: string };
    const ticker = typeof item.ticker === "string" ? item.ticker : item.symbol;
    const shares = item.shares ?? item.quantity;
    const buyPrice = item.buyPrice ?? item.costPerShare;
    const buyDate = typeof item.buyDate === "string" ? item.buyDate : item.boughtAt;
    if (!ticker || !isTrackedSymbol(ticker) || !isFinitePositive(shares) || !isFinitePositive(buyPrice) || typeof buyDate !== "string") {
      continue;
    }
    items.push({
      id: typeof item.id === "string" && item.id.length > 0 ? item.id : newEntityId(),
      ticker,
      companyName: typeof item.companyName === "string" && item.companyName.length > 0 ? item.companyName : companyNameFor(ticker),
      shares,
      buyPrice,
      buyDate: toDateInputValue(buyDate),
    });
    if (items.length >= MAX_HOLDINGS) break;
  }
  return items;
}

export function sanitizeWatchlistItems(value: unknown): WatchlistItemDTO[] | null {
  if (!Array.isArray(value)) return null;
  const items: WatchlistItemDTO[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (typeof row === "string") {
      if (!isTrackedSymbol(row) || seen.has(row)) continue;
      seen.add(row);
      items.push({
        id: newEntityId(),
        ticker: row,
        companyName: companyNameFor(row),
        addedAt: new Date().toISOString(),
      });
    } else if (row && typeof row === "object") {
      const item = row as Partial<WatchlistItemDTO> & { symbol?: string };
      const ticker = typeof item.ticker === "string" ? item.ticker : item.symbol;
      if (!ticker || !isTrackedSymbol(ticker) || seen.has(ticker)) continue;
      seen.add(ticker);
      items.push({
        id: typeof item.id === "string" && item.id.length > 0 ? item.id : newEntityId(),
        ticker,
        companyName: typeof item.companyName === "string" && item.companyName.length > 0 ? item.companyName : companyNameFor(ticker),
        addedAt: typeof item.addedAt === "string" ? item.addedAt : new Date().toISOString(),
      });
    }
    if (items.length >= MAX_WATCHLIST) break;
  }
  return items;
}

export function snapshotFromItems(
  portfolioItems: PortfolioItemDTO[],
  watchlistItems: WatchlistItemDTO[],
): UserDataSnapshot {
  const holdings = portfolioItems.map(itemToHolding);
  return {
    portfolio: {
      holdings,
      transactions: transactionsFromUnknown(null, holdings),
    },
    watchlist: watchlistItems.map((item) => item.ticker),
  };
}

export const EMPTY_PORTFOLIO: PortfolioSnapshot = { holdings: [], transactions: [] };
export const EMPTY_USER_DATA: UserDataSnapshot = {
  portfolio: EMPTY_PORTFOLIO,
  watchlist: [],
};

export function isHolding(value: unknown): value is Holding {
  if (typeof value !== "object" || value == null) return false;
  const row = value as Partial<Holding>;
  return (
    typeof row.id === "string" &&
    typeof row.symbol === "string" &&
    isTrackedSymbol(row.symbol) &&
    typeof row.quantity === "number" &&
    Number.isFinite(row.quantity) &&
    row.quantity > 0 &&
    typeof row.costPerShare === "number" &&
    Number.isFinite(row.costPerShare) &&
    row.costPerShare > 0 &&
    typeof row.boughtAt === "string"
  );
}

export function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== "object" || value == null) return false;
  const row = value as Partial<Transaction>;
  return (
    typeof row.id === "string" &&
    typeof row.symbol === "string" &&
    isTrackedSymbol(row.symbol) &&
    (row.type === "buy" || row.type === "sell") &&
    typeof row.quantity === "number" &&
    Number.isFinite(row.quantity) &&
    row.quantity > 0 &&
    typeof row.price === "number" &&
    Number.isFinite(row.price) &&
    row.price > 0 &&
    typeof row.fees === "number" &&
    Number.isFinite(row.fees) &&
    row.fees >= 0 &&
    typeof row.date === "string" &&
    (row.realizedPnl == null || (typeof row.realizedPnl === "number" && Number.isFinite(row.realizedPnl)))
  );
}

export function holdingsFromUnknown(value: unknown): Holding[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isHolding)
    .slice(0, MAX_HOLDINGS)
    .map((row) => ({ ...row, boughtAt: toDateInputValue(row.boughtAt) }));
}

export function transactionsFromUnknown(value: unknown, holdings: Holding[]): Transaction[] {
  if (Array.isArray(value)) {
    return value.filter(isTransaction).map((row) => ({
      ...row,
      date: toDateInputValue(row.date),
    }));
  }
  return holdings.map((holding) => ({
    id: `seed-${holding.id}`,
    symbol: holding.symbol,
    type: "buy" as const,
    quantity: holding.quantity,
    price: holding.costPerShare,
    fees: 0,
    date: holding.boughtAt,
    realizedPnl: null,
  }));
}

export function parsePortfolioSnapshot(raw: string | null, legacyRaw: string | null): PortfolioSnapshot {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "holdings" in parsed) {
        const bag = parsed as { holdings: unknown; transactions?: unknown };
        const holdings = holdingsFromUnknown(bag.holdings);
        return { holdings, transactions: transactionsFromUnknown(bag.transactions, holdings) };
      }
      if (Array.isArray(parsed)) {
        const asItems = sanitizePortfolioItems(parsed);
        const holdings = asItems && asItems.length > 0 ? asItems.map(itemToHolding) : holdingsFromUnknown(parsed);
        return { holdings, transactions: transactionsFromUnknown(null, holdings) };
      }
    } catch {
      /* fall through */
    }
  }

  if (legacyRaw) {
    try {
      const holdings = holdingsFromUnknown(JSON.parse(legacyRaw));
      return { holdings, transactions: transactionsFromUnknown(null, holdings) };
    } catch {
      return EMPTY_PORTFOLIO;
    }
  }

  return EMPTY_PORTFOLIO;
}

export function parseWatchlistSymbols(raw: string | null, fallback: string[] = DEFAULT_WATCHLIST): string[] {
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const asItems = sanitizeWatchlistItems(parsed);
    if (asItems && asItems.length > 0) return asItems.map((item) => item.ticker);
    return parsed
      .filter((value): value is string => typeof value === "string" && isTrackedSymbol(value))
      .slice(0, MAX_WATCHLIST);
  } catch {
    return fallback;
  }
}

export function sanitizePortfolio(value: unknown): PortfolioSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const bag = value as { holdings?: unknown; transactions?: unknown };
  if (!("holdings" in bag)) return null;
  const holdings = holdingsFromUnknown(bag.holdings);
  return { holdings, transactions: transactionsFromUnknown(bag.transactions, holdings) };
}

export function sanitizeWatchlist(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === "string" && isTrackedSymbol(item))
    .slice(0, MAX_WATCHLIST);
}

export function newEntityId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
