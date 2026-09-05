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
  readGuestSnapshotForMigration,
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
  loading: boolean;
  error: string | null;
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

function snapshotFromResponse(data: UserDataResponse, transactions?: UserDataSnapshot["portfolio"]["transactions"]): UserDataSnapshot {
  return {
    portfolio: {
      holdings: data.portfolio.holdings,
      transactions: transactions ?? data.portfolio.transactions,
    },
    watchlist: data.watchlist,
  };
}

async function fetchUserData(): Promise<UserDataResponse> {
  const response = await fetch("/api/user/data", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load user data (${response.status})`);
  return (await response.json()) as UserDataResponse;
}

async function postUserData(body: Record<string, unknown>): Promise<UserDataResponse> {
  const response = await fetch("/api/user/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Failed to save user data (${response.status})`);
  return (await response.json()) as UserDataResponse;
}

function syncBody(snapshot: UserDataSnapshot): Record<string, unknown> {
  return {
    action: "sync",
    portfolio: snapshot.portfolio.holdings.map(holdingToItem),
    watchlist: snapshot.watchlist,
  };
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const guest = useSyncExternalStore(subscribeGuest, readGuestCached, () => SERVER_SNAPSHOT);
  const [remote, setRemote] = useState<UserDataSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remoteRef = useRef<UserDataSnapshot>(EMPTY_USER_DATA);
  const writeChain = useRef(Promise.resolve());
  const prevStatus = useRef(status);

  useEffect(() => {
    if (status !== "authenticated") {
      setRemote(null);
      setReady(status === "unauthenticated");
      setError(null);
      prevStatus.current = status;
      return;
    }

    let cancelled = false;
    setReady(false);
    setError(null);

    void (async () => {
      const data = await fetchUserData();
      if (cancelled) return;

      const guestPayload = readGuestSnapshotForMigration();
      const shouldMigrate = Boolean(guestPayload) && (!data.initialized || prevStatus.current === "unauthenticated");

      if (shouldMigrate && guestPayload && !data.initialized) {
        const saved = await postUserData(syncBody(guestPayload));
        if (cancelled) return;
        const next = snapshotFromResponse(saved, guestPayload.portfolio.transactions);
        remoteRef.current = next;
        setRemote(next);
      } else {
        const next = snapshotFromResponse(data);
        remoteRef.current = next;
        setRemote(next);
      }

      clearGuestStorage();
      guestCache = null;
      setReady(true);
      prevStatus.current = "authenticated";
    })().catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : "Failed to load account data");
      setReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const snapshot =
    status === "authenticated" ? (remote ?? EMPTY_USER_DATA) : status === "unauthenticated" ? guest : SERVER_SNAPSHOT;

  const persist = useCallback(
    (next: UserDataSnapshot, body?: Record<string, unknown>) => {
      if (status !== "authenticated") {
        writeGuest(next);
        return;
      }

      remoteRef.current = next;
      setRemote(next);
      writeChain.current = writeChain.current
        .catch(() => undefined)
        .then(async () => {
          const saved = await postUserData(body ?? syncBody(remoteRef.current));
          const reconciled = snapshotFromResponse(saved, remoteRef.current.portfolio.transactions);
          remoteRef.current = reconciled;
          setRemote(reconciled);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Failed to save account data");
        });
    },
    [status],
  );

  const upsert = useCallback<UserDataContextValue["upsert"]>(
    (input) => {
      const { next, error: upsertError } = upsertHolding(snapshot, input);
      if (upsertError) return upsertError;
      persist(next);
      return null;
    },
    [persist, snapshot],
  );

  const update = useCallback<UserDataContextValue["update"]>(
    (id, patch) => {
      const next = updateHolding(snapshot, id, patch);
      const item = next.portfolio.holdings.find((row) => row.id === id);
      persist(
        next,
        item
          ? { action: "edit", target: "portfolio", id, item: holdingToItem(item) }
          : { action: "delete", target: "portfolio", id },
      );
    },
    [persist, snapshot],
  );

  const remove = useCallback(
    (id: string) => {
      persist(removeHolding(snapshot, id), { action: "delete", target: "portfolio", id });
    },
    [persist, snapshot],
  );

  const sell = useCallback<UserDataContextValue["sell"]>(
    (input) => {
      const { next, error: sellError } = sellHolding(snapshot, input);
      if (sellError) return sellError;
      persist(next);
      return null;
    },
    [persist, snapshot],
  );

  const add = useCallback(
    (symbol: string) => {
      persist(addWatchlistSymbol(snapshot, symbol), {
        action: "add",
        target: "watchlist",
        ticker: symbol,
      });
    },
    [persist, snapshot],
  );

  const removeSymbol = useCallback(
    (symbol: string) => {
      persist(removeWatchlistSymbol(snapshot, symbol), {
        action: "delete",
        target: "watchlist",
        ticker: symbol,
      });
    },
    [persist, snapshot],
  );

  const toggle = useCallback(
    (symbol: string) => {
      const next = toggleWatchlistSymbol(snapshot, symbol);
      persist(next, {
        action: snapshot.watchlist.includes(symbol) ? "delete" : "add",
        target: "watchlist",
        ticker: symbol,
      });
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
  const loading = status === "loading" || (status === "authenticated" && !ready);

  const value = useMemo<UserDataContextValue>(
    () => ({
      portfolio: snapshot.portfolio,
      watchlist: snapshot.watchlist,
      status,
      ready,
      loading,
      error,
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
    [
      add,
      error,
      loading,
      ready,
      remove,
      removeSymbol,
      reorder,
      reset,
      saved,
      sell,
      snapshot,
      status,
      toggle,
      update,
      upsert,
    ],
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
