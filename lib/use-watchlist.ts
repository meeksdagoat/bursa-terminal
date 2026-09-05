"use client";

import { useSession } from "next-auth/react";
import { useUserData } from "@/components/providers/UserDataProvider";

export type Watchlist = {
  symbols: string[];
  status: "loading" | "authenticated" | "unauthenticated";
  loading: boolean;
  error: string | null;
  saved: (symbol: string) => boolean;
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
  toggle: (symbol: string) => void;
  /** Move `fromSymbol` to the list slot currently held by `toSymbol`. */
  reorder: (fromSymbol: string, toSymbol: string) => void;
  reset: () => void;
};

export function useWatchlist(): Watchlist {
  const { status } = useSession();
  const data = useUserData();
  const loading = status === "loading" || (status === "authenticated" && !data.ready);

  return {
    symbols: loading && status === "authenticated" ? [] : data.watchlist,
    status,
    loading,
    error: data.error,
    saved: data.saved,
    add: data.add,
    remove: data.removeSymbol,
    toggle: data.toggle,
    reorder: data.reorder,
    reset: data.reset,
  };
}
