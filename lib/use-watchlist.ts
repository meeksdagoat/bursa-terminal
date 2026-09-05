"use client";

import { useUserData } from "@/components/providers/UserDataProvider";

export type Watchlist = {
  symbols: string[];
  saved: (symbol: string) => boolean;
  add: (symbol: string) => void;
  remove: (symbol: string) => void;
  toggle: (symbol: string) => void;
  /** Move `fromSymbol` to the list slot currently held by `toSymbol`. */
  reorder: (fromSymbol: string, toSymbol: string) => void;
  reset: () => void;
};

export function useWatchlist(): Watchlist {
  const data = useUserData();
  return {
    symbols: data.watchlist,
    saved: data.saved,
    add: data.add,
    remove: data.removeSymbol,
    toggle: data.toggle,
    reorder: data.reorder,
    reset: data.reset,
  };
}
