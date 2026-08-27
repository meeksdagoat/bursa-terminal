"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_WATCHLIST, isTrackedSymbol } from "./universe";

const STORAGE_KEY = "bursa-terminal:watchlist:v1";
const MAX_SYMBOLS = 60;

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

/**
 * localStorage is the source of truth, read through useSyncExternalStore so the
 * list survives reloads, stays in sync across tabs, and hydrates from the
 * seeded defaults without a client/server markup mismatch.
 */

const listeners = new Set<() => void>();

// getSnapshot must be referentially stable between reads, so the parsed list is
// memoised against the raw string it came from.
let cachedRaw: string | null = null;
let cachedSymbols: string[] = DEFAULT_WATCHLIST;

function parse(raw: string | null): string[] {
  if (!raw) return DEFAULT_WATCHLIST;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_WATCHLIST;

    // Drops symbols retired from the universe between releases.
    return parsed
      .filter((value): value is string => typeof value === "string" && isTrackedSymbol(value))
      .slice(0, MAX_SYMBOLS);
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST;

  const raw = readRaw();
  if (raw === cachedRaw) return cachedSymbols;

  cachedRaw = raw;
  cachedSymbols = parse(raw);
  return cachedSymbols;
}

function getServerSnapshot(): string[] {
  return DEFAULT_WATCHLIST;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function write(symbols: string[]): void {
  const raw = JSON.stringify(symbols);

  // The in-memory cache is updated even if the write is rejected (private
  // browsing, quota) so the terminal still works for the rest of the session.
  cachedRaw = raw;
  cachedSymbols = symbols;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    cachedRaw = null;
  }

  for (const listener of listeners) listener();
}

function update(mutate: (current: string[]) => string[]): void {
  const next = mutate(getSnapshot());
  write(next.slice(0, MAX_SYMBOLS));
}

export function useWatchlist(): Watchlist {
  const symbols = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const membership = useMemo(() => new Set(symbols), [symbols]);

  const add = useCallback((symbol: string) => {
    if (!isTrackedSymbol(symbol)) return;
    update((current) => (current.includes(symbol) ? current : [...current, symbol]));
  }, []);

  const remove = useCallback((symbol: string) => {
    update((current) => current.filter((value) => value !== symbol));
  }, []);

  const toggle = useCallback((symbol: string) => {
    if (!isTrackedSymbol(symbol)) return;
    update((current) =>
      current.includes(symbol)
        ? current.filter((value) => value !== symbol)
        : [...current, symbol],
    );
  }, []);

  const reorder = useCallback((fromSymbol: string, toSymbol: string) => {
    if (fromSymbol === toSymbol) return;
    update((current) => {
      const from = current.indexOf(fromSymbol);
      const to = current.indexOf(toSymbol);
      if (from < 0 || to < 0 || from === to) return current;

      const next = current.filter((symbol) => symbol !== fromSymbol);
      const insertAt = next.indexOf(toSymbol);
      if (insertAt < 0) return current;
      next.splice(insertAt, 0, fromSymbol);
      return next;
    });
  }, []);

  const reset = useCallback(() => write(DEFAULT_WATCHLIST), []);

  const saved = useCallback((symbol: string) => membership.has(symbol), [membership]);

  return { symbols, saved, add, remove, toggle, reorder, reset };
}
