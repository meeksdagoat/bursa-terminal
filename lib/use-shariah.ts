"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "bursa-terminal:shariah-only:v1";

/**
 * Global "Shariah only" filter. localStorage is the source of truth, read
 * through useSyncExternalStore so the setting survives navigation and reloads,
 * stays in sync across tabs, and renders the same on server and first client
 * paint.
 */

const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function write(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Private browsing or a full quota: the toggle still applies for this render.
  }
  for (const listener of listeners) listener();
}

export function useShariahOnly(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function useShariahFilter(): { shariahOnly: boolean; setShariahOnly: (on: boolean) => void } {
  const shariahOnly = useShariahOnly();
  const setShariahOnly = useCallback((on: boolean) => write(on), []);
  return { shariahOnly, setShariahOnly };
}
