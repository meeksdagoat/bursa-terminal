import { toDateInputValue, weightedAverage, type Holding } from "./portfolio";
import { DEFAULT_WATCHLIST, isTrackedSymbol } from "./universe";
import { MAX_HOLDINGS, MAX_WATCHLIST, newEntityId, type PortfolioSnapshot, type UserDataSnapshot } from "./user-data";

export type UpsertHoldingInput = {
  symbol: string;
  quantity: number;
  costPerShare: number;
  boughtAt: string;
  fees?: number;
};

export type SellHoldingInput = {
  holdingId: string;
  quantity: number;
  price: number;
  fees?: number;
  date: string;
};

function withPortfolio(state: UserDataSnapshot, portfolio: PortfolioSnapshot): UserDataSnapshot {
  return { ...state, portfolio };
}

export function upsertHolding(state: UserDataSnapshot, input: UpsertHoldingInput): { next: UserDataSnapshot; error: string | null } {
  if (!isTrackedSymbol(input.symbol)) return { next: state, error: "That ticker is not in the Bursa universe" };
  if (!(input.quantity > 0)) return { next: state, error: "Quantity must be greater than zero" };
  if (!(input.costPerShare > 0)) return { next: state, error: "Buy price must be greater than zero" };

  const boughtAt = toDateInputValue(input.boughtAt);
  const fees = Number.isFinite(input.fees) && (input.fees ?? 0) >= 0 ? (input.fees ?? 0) : 0;
  const current = state.portfolio;
  const existing = current.holdings.find((row) => row.symbol === input.symbol);

  if (!existing && current.holdings.length >= MAX_HOLDINGS) {
    return { next: state, error: "Portfolio is full (40 names)" };
  }

  const trade = {
    id: newEntityId(),
    symbol: input.symbol,
    type: "buy" as const,
    quantity: input.quantity,
    price: input.costPerShare,
    fees,
    date: boughtAt,
    realizedPnl: null,
  };

  if (!existing) {
    return {
      next: withPortfolio(state, {
        holdings: [
          ...current.holdings,
          {
            id: newEntityId(),
            symbol: input.symbol,
            quantity: input.quantity,
            costPerShare: input.costPerShare,
            boughtAt,
          },
        ],
        transactions: [trade, ...current.transactions],
      }),
      error: null,
    };
  }

  const earlier = existing.boughtAt <= boughtAt ? existing.boughtAt : boughtAt;

  return {
    next: withPortfolio(state, {
      holdings: current.holdings.map((row) =>
        row.id === existing.id
          ? {
              ...row,
              quantity: row.quantity + input.quantity,
              costPerShare: weightedAverage(row.quantity, row.costPerShare, input.quantity, input.costPerShare),
              boughtAt: earlier,
            }
          : row,
      ),
      transactions: [trade, ...current.transactions],
    }),
    error: null,
  };
}

export function updateHolding(
  state: UserDataSnapshot,
  id: string,
  patch: Partial<Pick<Holding, "quantity" | "costPerShare" | "boughtAt">>,
): UserDataSnapshot {
  return withPortfolio(state, {
    ...state.portfolio,
    holdings: state.portfolio.holdings.flatMap((row) => {
      if (row.id !== id) return [row];

      const quantity = patch.quantity ?? row.quantity;
      const costPerShare = patch.costPerShare ?? row.costPerShare;
      const boughtAt = patch.boughtAt ? toDateInputValue(patch.boughtAt) : row.boughtAt;

      if (!(quantity > 0) || !(costPerShare > 0)) return [];

      return [{ ...row, quantity, costPerShare, boughtAt }];
    }),
  });
}

export function removeHolding(state: UserDataSnapshot, id: string): UserDataSnapshot {
  return withPortfolio(state, {
    ...state.portfolio,
    holdings: state.portfolio.holdings.filter((row) => row.id !== id),
  });
}

export function sellHolding(state: UserDataSnapshot, input: SellHoldingInput): { next: UserDataSnapshot; error: string | null } {
  if (!(input.quantity > 0)) return { next: state, error: "Quantity must be greater than zero" };
  if (!(input.price > 0)) return { next: state, error: "Sell price must be greater than zero" };

  const fees = Number.isFinite(input.fees) && (input.fees ?? 0) >= 0 ? (input.fees ?? 0) : 0;
  const holding = state.portfolio.holdings.find((row) => row.id === input.holdingId);
  if (!holding) return { next: state, error: "Holding not found" };
  if (input.quantity > holding.quantity + 1e-9) return { next: state, error: "Cannot sell more shares than you hold" };

  const realizedPnl = (input.price - holding.costPerShare) * input.quantity - fees;
  const remaining = holding.quantity - input.quantity;
  const date = toDateInputValue(input.date);

  const trade = {
    id: newEntityId(),
    symbol: holding.symbol,
    type: "sell" as const,
    quantity: input.quantity,
    price: input.price,
    fees,
    date,
    realizedPnl,
  };

  return {
    next: withPortfolio(state, {
      holdings:
        remaining > 1e-9
          ? state.portfolio.holdings.map((row) =>
              row.id === holding.id ? { ...row, quantity: remaining } : row,
            )
          : state.portfolio.holdings.filter((row) => row.id !== holding.id),
      transactions: [trade, ...state.portfolio.transactions],
    }),
    error: null,
  };
}

export function addWatchlistSymbol(state: UserDataSnapshot, symbol: string): UserDataSnapshot {
  if (!isTrackedSymbol(symbol) || state.watchlist.includes(symbol)) return state;
  return { ...state, watchlist: [...state.watchlist, symbol].slice(0, MAX_WATCHLIST) };
}

export function removeWatchlistSymbol(state: UserDataSnapshot, symbol: string): UserDataSnapshot {
  return { ...state, watchlist: state.watchlist.filter((value) => value !== symbol) };
}

export function toggleWatchlistSymbol(state: UserDataSnapshot, symbol: string): UserDataSnapshot {
  if (!isTrackedSymbol(symbol)) return state;
  return state.watchlist.includes(symbol)
    ? removeWatchlistSymbol(state, symbol)
    : addWatchlistSymbol(state, symbol);
}

export function reorderWatchlist(state: UserDataSnapshot, fromSymbol: string, toSymbol: string): UserDataSnapshot {
  if (fromSymbol === toSymbol) return state;
  const from = state.watchlist.indexOf(fromSymbol);
  const to = state.watchlist.indexOf(toSymbol);
  if (from < 0 || to < 0 || from === to) return state;

  const next = state.watchlist.filter((symbol) => symbol !== fromSymbol);
  const insertAt = next.indexOf(toSymbol);
  if (insertAt < 0) return state;
  next.splice(insertAt, 0, fromSymbol);
  return { ...state, watchlist: next };
}

export function resetWatchlist(state: UserDataSnapshot): UserDataSnapshot {
  return { ...state, watchlist: DEFAULT_WATCHLIST };
}
