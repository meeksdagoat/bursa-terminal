"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  toDateInputValue,
  weightedAverage,
  type Holding,
  type Transaction,
} from "./portfolio";
import { isTrackedSymbol } from "./universe";

const STORAGE_V1 = "bursa-terminal:portfolio:v1";
const STORAGE_KEY = "bursa-terminal:portfolio:v2";
const MAX_HOLDINGS = 40;
const EMPTY: PortfolioSnapshot = { holdings: [], transactions: [] };

export type PortfolioSnapshot = {
  holdings: Holding[];
  transactions: Transaction[];
};

export type PortfolioStore = PortfolioSnapshot & {
  upsert: (input: {
    symbol: string;
    quantity: number;
    costPerShare: number;
    boughtAt: string;
    fees?: number;
  }) => string | null;
  update: (id: string, patch: Partial<Pick<Holding, "quantity" | "costPerShare" | "boughtAt">>) => void;
  remove: (id: string) => void;
  sell: (input: {
    holdingId: string;
    quantity: number;
    price: number;
    fees?: number;
    date: string;
  }) => string | null;
};

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedState: PortfolioSnapshot = EMPTY;

function isHolding(value: unknown): value is Holding {
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

function isTransaction(value: unknown): value is Transaction {
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

function holdingsFromUnknown(value: unknown): Holding[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isHolding)
    .slice(0, MAX_HOLDINGS)
    .map((row) => ({ ...row, boughtAt: toDateInputValue(row.boughtAt) }));
}

function transactionsFromUnknown(value: unknown, holdings: Holding[]): Transaction[] {
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

function parse(raw: string | null, legacyRaw: string | null): PortfolioSnapshot {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "holdings" in parsed) {
        const bag = parsed as { holdings: unknown; transactions?: unknown };
        const holdings = holdingsFromUnknown(bag.holdings);
        return { holdings, transactions: transactionsFromUnknown(bag.transactions, holdings) };
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
      return EMPTY;
    }
  }

  return EMPTY;
}

function readRaw(): { current: string | null; legacy: string | null } {
  try {
    return {
      current: window.localStorage.getItem(STORAGE_KEY),
      legacy: window.localStorage.getItem(STORAGE_V1),
    };
  } catch {
    return { current: null, legacy: null };
  }
}

function getSnapshot(): PortfolioSnapshot {
  if (typeof window === "undefined") return EMPTY;

  const { current, legacy } = readRaw();
  const key = `${current ?? ""}|${legacy ?? ""}`;
  if (key === cachedRaw) return cachedState;

  cachedRaw = key;
  cachedState = parse(current, legacy);
  return cachedState;
}

function getServerSnapshot(): PortfolioSnapshot {
  return EMPTY;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function write(state: PortfolioSnapshot): void {
  const raw = JSON.stringify(state);
  cachedRaw = `${raw}|`;
  cachedState = state;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    cachedRaw = null;
  }

  for (const listener of listeners) listener();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePortfolio(): PortfolioStore {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const upsert = useCallback<PortfolioStore["upsert"]>((input) => {
    if (!isTrackedSymbol(input.symbol)) return "That ticker is not in the Bursa universe";
    if (!(input.quantity > 0)) return "Quantity must be greater than zero";
    if (!(input.costPerShare > 0)) return "Buy price must be greater than zero";

    const boughtAt = toDateInputValue(input.boughtAt);
    const fees = Number.isFinite(input.fees) && (input.fees ?? 0) >= 0 ? (input.fees ?? 0) : 0;
    const current = getSnapshot();
    const existing = current.holdings.find((row) => row.symbol === input.symbol);

    if (!existing && current.holdings.length >= MAX_HOLDINGS) {
      return "Portfolio is full (40 names)";
    }

    const trade: Transaction = {
      id: newId(),
      symbol: input.symbol,
      type: "buy",
      quantity: input.quantity,
      price: input.costPerShare,
      fees,
      date: boughtAt,
      realizedPnl: null,
    };

    if (!existing) {
      write({
        holdings: [
          ...current.holdings,
          {
            id: newId(),
            symbol: input.symbol,
            quantity: input.quantity,
            costPerShare: input.costPerShare,
            boughtAt,
          },
        ],
        transactions: [trade, ...current.transactions],
      });
      return null;
    }

    const earlier = existing.boughtAt <= boughtAt ? existing.boughtAt : boughtAt;

    write({
      holdings: current.holdings.map((row) =>
        row.id === existing.id
          ? {
              ...row,
              quantity: row.quantity + input.quantity,
              costPerShare: weightedAverage(
                row.quantity,
                row.costPerShare,
                input.quantity,
                input.costPerShare,
              ),
              boughtAt: earlier,
            }
          : row,
      ),
      transactions: [trade, ...current.transactions],
    });

    return null;
  }, []);

  const update = useCallback<PortfolioStore["update"]>((id, patch) => {
    const current = getSnapshot();
    write({
      ...current,
      holdings: current.holdings.flatMap((row) => {
        if (row.id !== id) return [row];

        const quantity = patch.quantity ?? row.quantity;
        const costPerShare = patch.costPerShare ?? row.costPerShare;
        const boughtAt = patch.boughtAt ? toDateInputValue(patch.boughtAt) : row.boughtAt;

        if (!(quantity > 0) || !(costPerShare > 0)) return [];

        return [{ ...row, quantity, costPerShare, boughtAt }];
      }),
    });
  }, []);

  const remove = useCallback((id: string) => {
    const current = getSnapshot();
    write({
      ...current,
      holdings: current.holdings.filter((row) => row.id !== id),
    });
  }, []);

  const sell = useCallback<PortfolioStore["sell"]>((input) => {
    if (!(input.quantity > 0)) return "Quantity must be greater than zero";
    if (!(input.price > 0)) return "Sell price must be greater than zero";
    const fees = Number.isFinite(input.fees) && (input.fees ?? 0) >= 0 ? (input.fees ?? 0) : 0;
    const current = getSnapshot();
    const holding = current.holdings.find((row) => row.id === input.holdingId);
    if (!holding) return "Holding not found";
    if (input.quantity > holding.quantity + 1e-9) return "Cannot sell more shares than you hold";

    const realizedPnl = (input.price - holding.costPerShare) * input.quantity - fees;
    const remaining = holding.quantity - input.quantity;
    const date = toDateInputValue(input.date);

    const trade: Transaction = {
      id: newId(),
      symbol: holding.symbol,
      type: "sell",
      quantity: input.quantity,
      price: input.price,
      fees,
      date,
      realizedPnl,
    };

    write({
      holdings:
        remaining > 1e-9
          ? current.holdings.map((row) =>
              row.id === holding.id ? { ...row, quantity: remaining } : row,
            )
          : current.holdings.filter((row) => row.id !== holding.id),
      transactions: [trade, ...current.transactions],
    });

    return null;
  }, []);

  return {
    holdings: snapshot.holdings,
    transactions: snapshot.transactions,
    upsert,
    update,
    remove,
    sell,
  };
}
