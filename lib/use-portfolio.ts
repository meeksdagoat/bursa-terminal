"use client";

import { useUserData } from "@/components/providers/UserDataProvider";
import type { Holding } from "./portfolio";
import type { PortfolioSnapshot } from "./user-data";

export type { PortfolioSnapshot };

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

export function usePortfolio(): PortfolioStore {
  const data = useUserData();
  return {
    holdings: data.portfolio.holdings,
    transactions: data.portfolio.transactions,
    upsert: data.upsert,
    update: data.update,
    remove: data.remove,
    sell: data.sell,
  };
}
