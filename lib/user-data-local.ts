"use client";

import { DEFAULT_WATCHLIST } from "./universe";
import {
  EMPTY_PORTFOLIO,
  PORTFOLIO_DATA_KEY,
  PORTFOLIO_STORAGE_KEY,
  PORTFOLIO_STORAGE_V1,
  WATCHLIST_DATA_KEY,
  WATCHLIST_STORAGE_KEY,
  parsePortfolioSnapshot,
  parseWatchlistSymbols,
  type PortfolioSnapshot,
  type UserDataSnapshot,
} from "./user-data";

export const GUEST_STORAGE_KEYS = [
  PORTFOLIO_STORAGE_KEY,
  PORTFOLIO_STORAGE_V1,
  WATCHLIST_STORAGE_KEY,
  PORTFOLIO_DATA_KEY,
  WATCHLIST_DATA_KEY,
] as const;

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readGuestPortfolio(): PortfolioSnapshot {
  if (typeof window === "undefined") return EMPTY_PORTFOLIO;
  const current = readItem(PORTFOLIO_STORAGE_KEY) ?? readItem(PORTFOLIO_DATA_KEY);
  const legacy = readItem(PORTFOLIO_STORAGE_V1);
  return parsePortfolioSnapshot(current, legacy);
}

export function readGuestWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST;
  const raw = readItem(WATCHLIST_STORAGE_KEY) ?? readItem(WATCHLIST_DATA_KEY);
  return parseWatchlistSymbols(raw);
}

export function readGuestUserData(): UserDataSnapshot {
  return {
    portfolio: readGuestPortfolio(),
    watchlist: readGuestWatchlist(),
  };
}

export function hasGuestStorage(): boolean {
  if (typeof window === "undefined") return false;
  return GUEST_STORAGE_KEYS.some((key) => readItem(key) != null);
}

export function writeGuestPortfolio(state: PortfolioSnapshot): void {
  try {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(state));
    window.localStorage.removeItem(PORTFOLIO_DATA_KEY);
  } catch {
    /* private browsing / quota */
  }
}

export function writeGuestWatchlist(symbols: string[]): void {
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
    window.localStorage.removeItem(WATCHLIST_DATA_KEY);
  } catch {
    /* private browsing / quota */
  }
}

export function writeGuestUserData(state: UserDataSnapshot): void {
  writeGuestPortfolio(state.portfolio);
  writeGuestWatchlist(state.watchlist);
}

export function clearGuestStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of GUEST_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
