"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Holding } from "@/lib/portfolio";
import { DEFAULT_WATCHLIST } from "@/lib/universe";
import {
  addWatchlistSymbol,
  removeHolding,
  removeWatchlistSymbol,
  reorderWatchlist,
  resetWatchlist,
  sellHolding,
  toggleWatchlistSymbol,
  updateHolding,
  upsertHolding,
  type SellHoldingInput,
  type UpsertHoldingInput,
} from "@/lib/user-data-actions";
import {
  clearGuestStorage,
  hasGuestStorage,
  readGuestUserData,
  writeGuestUserData,
} from "@/lib/user-data-local";
import {
  EMPTY_PORTFOLIO,
  EMPTY_USER_DATA,
  holdingToItem,
  type UserDataResponse,
  type UserDataSnapshot,
} from "@/lib/user-data";

export type UserDataContextValue = UserDataSnapshot & {
  status: "loading" | "authenticated" | "unauthenticated";
  ready: boolean;
  upsert: (input: UpsertHoldingInput) => string | null;
  update: (id: string, patch: Partial<Pick<Holding, "quantity" | "costPerShare" | "boughtAt">>) => void;
  remove: (id: string) => void;
  sell: (input: SellHoldingInput) => string | null;
  saved: (symbol: string) => boolean;
  add: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  toggle: (symbol: string) => void;
  reorder: (fromSymbol: string, toSymbol: string) => void;
  reset: () => void;
};

const UserDataContext = createContext<UserDataContextValue | null>(null);

const SERVER_SNAPSHOT: UserDataSnapshot = {
  portfolio: EMPTY_PORTFOLIO,
  watchlist: DEFAULT_WATCHLIST,
};

const guestListeners = new Set<() => void>();
let guestCache: UserDataSnapshot | null = null;

function emitGuest() {
  for (const listener of guestListeners) listener();
}

function readGuestCached(): UserDataSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (!guestCache) guestCache = readGuestUserData();
  return guestCache;
}

function writeGuest(next: UserDataSnapshot) {
  guestCache = next;
  writeGuestUserData(next);
  emitGuest();
}

function subscribeGuest(onStoreChange: () => void) {
  guestListeners.add(onStoreChange);
  const onStorage = () => {
    guestCache = null;
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    guestListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

async function fetchUserData(): Promise<UserDataResponse> {
  const response = await fetch("/api/user/data", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load user data (${response.status})`);
  return (await response.json()) as UserDataResponse;
}

async function postUserData(snapshot: UserDataSnapshot, extra?: Record<string, unknown>): Promise<UserDataResponse> {
  const response = await fetch("/api/user/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sync",
      portfolio: snapshot.portfolio.holdings.map(holdingToItem),
      watchlist: snapshot.watchlist,
      ...extra,
    }),
  });
  if (!response.ok) throw new Error(`Failed to save user data (${response.status})`);
  return (await response.json()) as UserDataResponse;
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const guest = useSyncExternalStore(subscribeGuest, readGuestCached, () => SERVER_SNAPSHOT);
  const [remote, setRemote] = useState<UserDataSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const remoteRef = useRef<UserDataSnapshot>(EMPTY_USER_DATA);
  const writeChain = useRef(Promise.resolve());

  useEffect(() => {
    if (status !== "authenticated") {
      setRemote(null);
      setReady(status === "unauthenticated");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchUserData();
        if (cancelled) return;

        if (!data.initialized) {
          const local = readGuestCached();
          const payload = hasGuestStorage()
            ? local
            : { portfolio: local.portfolio, watchlist: local.watchlist };
          await postUserData(payload);
          clearGuestStorage();
          guestCache = { portfolio: EMPTY_PORTFOLIO, watchlist: DEFAULT_WATCHLIST };
          if (cancelled) return;
          remoteRef.current = payload;
          setRemote(payload);
          setReady(true);
          return;
        }

        const snapshot: UserDataSnapshot = {
          portfolio: data.portfolio,
          watchlist: data.watchlist,
        };
        remoteRef.current = snapshot;
        setRemote(snapshot);
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const snapshot =
    status === "authenticated" ? (remote ?? EMPTY_USER_DATA) : status === "unauthenticated" ? guest : SERVER_SNAPSHOT;

  const persist = useCallback(
    (next: UserDataSnapshot) => {
      if (status === "authenticated") {
        remoteRef.current = next;
        setRemote(next);
        writeChain.current = writeChain.current
          .catch(() => undefined)
          .then(async () => {
            const saved = await postUserData(remoteRef.current);
            const next: UserDataSnapshot = {
              portfolio: {
                holdings: saved.portfolio.holdings,
                transactions: remoteRef.current.portfolio.transactions,
              },
              watchlist: saved.watchlist,
            };
            remoteRef.current = next;
            setRemote(next);
          });
        return;
      }
      writeGuest(next);
    },
    [status],
  );

  const upsert = useCallback<UserDataContextValue["upsert"]>(
    (input) => {
      const { next, error } = upsertHolding(snapshot, input);
      if (error) return error;
      persist(next);
      return null;
    },
    [persist, snapshot],
  );

  const update = useCallback<UserDataContextValue["update"]>(
    (id, patch) => {
      persist(updateHolding(snapshot, id, patch));
    },
    [persist, snapshot],
  );

  const remove = useCallback(
    (id: string) => {
      persist(removeHolding(snapshot, id));
    },
    [persist, snapshot],
  );

  const sell = useCallback<UserDataContextValue["sell"]>(
    (input) => {
      const { next, error } = sellHolding(snapshot, input);
      if (error) return error;
      persist(next);
      return null;
    },
    [persist, snapshot],
  );

  const add = useCallback(
    (symbol: string) => {
      persist(addWatchlistSymbol(snapshot, symbol));
    },
    [persist, snapshot],
  );

  const removeSymbol = useCallback(
    (symbol: string) => {
      persist(removeWatchlistSymbol(snapshot, symbol));
    },
    [persist, snapshot],
  );

  const toggle = useCallback(
    (symbol: string) => {
      persist(toggleWatchlistSymbol(snapshot, symbol));
    },
    [persist, snapshot],
  );

  const reorder = useCallback(
    (fromSymbol: string, toSymbol: string) => {
      persist(reorderWatchlist(snapshot, fromSymbol, toSymbol));
    },
    [persist, snapshot],
  );

  const reset = useCallback(() => {
    persist(resetWatchlist(snapshot));
  }, [persist, snapshot]);

  const membership = useMemo(() => new Set(snapshot.watchlist), [snapshot.watchlist]);
  const saved = useCallback((symbol: string) => membership.has(symbol), [membership]);

  const value = useMemo<UserDataContextValue>(
    () => ({
      portfolio: snapshot.portfolio,
      watchlist: snapshot.watchlist,
      status,
      ready,
      upsert,
      update,
      remove,
      sell,
      saved,
      add,
      removeSymbol,
      toggle,
      reorder,
      reset,
    }),
    [add, ready, remove, removeSymbol, reorder, reset, saved, sell, snapshot, status, toggle, update, upsert],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within UserDataProvider");
  }
  return ctx;
}
