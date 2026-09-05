"use client";

import { useSession } from "next-auth/react";
import { useUserData } from "@/components/providers/UserDataProvider";
import type { Holding } from "./portfolio";
import type { PortfolioSnapshot } from "./user-data";

export type { PortfolioSnapshot };

export type PortfolioStore = PortfolioSnapshot & {
  status: "loading" | "authenticated" | "unauthenticated";
  loading: boolean;
  error: string | null;
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
  const { status } = useSession();
  const data = useUserData();
  const loading = status === "loading" || (status === "authenticated" && !data.ready);

  return {
    holdings: loading && status === "authenticated" ? [] : data.portfolio.holdings,
    transactions: loading && status === "authenticated" ? [] : data.portfolio.transactions,
    status,
    loading,
    error: data.error,
    upsert: data.upsert,
    update: data.update,
    remove: data.remove,
    sell: data.sell,
  };
}
