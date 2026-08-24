"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveData<T> = {
  data: T | null;
  error: string | null;
  /** True until the first response for this hook instance arrives. */
  loading: boolean;
  updatedAt: number | null;
  /** Round-trip of the latest successful fetch, in milliseconds. */
  latencyMs: number | null;
  refresh: () => void;
};

/**
 * Polls a JSON endpoint on an interval, pausing while the tab is hidden and
 * refetching as soon as it becomes visible again.
 */
export function useLiveData<T>(url: string, intervalMs: number): LiveData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const latencyRef = useRef<number | null>(null);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const started = performance.now();

      try {
        const response = await fetch(url, { signal: controller.signal });
        const payload: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Request failed (${response.status})`;
          throw new Error(message);
        }

        if (cancelled) return;
        const rtt = Math.max(0, Math.round(performance.now() - started));
        setData(payload as T);
        setError(null);
        setUpdatedAt(Date.now());
        if (latencyRef.current !== rtt) {
          latencyRef.current = rtt;
          setLatencyMs(rtt);
        }
      } catch (cause) {
        if (cancelled || (cause instanceof DOMException && cause.name === "AbortError")) return;
        setError(cause instanceof Error ? cause.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, intervalMs);

    function onVisibilityChange() {
      if (!document.hidden) void load();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [url, intervalMs, nonce]);

  return { data, error, loading, updatedAt, latencyMs, refresh };
}
