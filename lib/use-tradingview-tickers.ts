"use client";

import { useEffect, useState } from "react";
import { GLOBAL_TICKER_SPECS } from "./global-ticker-catalog";
import type { GlobalTickerQuote, GlobalTickersPayload } from "./types";

function emptyPayload(): GlobalTickersPayload {
  return {
    source: "tradingview",
    asOf: new Date().toISOString(),
    tickers: GLOBAL_TICKER_SPECS.map((spec) => ({
      id: spec.id,
      label: spec.label,
      symbol: spec.symbol,
      unit: spec.unit,
      kind: spec.kind,
      price: null,
      changePct: null,
      currency: spec.kind === "yield" ? null : "USD",
      asOf: null,
    })),
    errors: [],
  };
}

function isPayload(value: unknown): value is GlobalTickersPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "tickers" in value &&
    Array.isArray((value as GlobalTickersPayload).tickers)
  );
}

export type LiveTickerFeed = {
  data: GlobalTickersPayload;
  error: string | null;
};

/**
 * Subscribes to the server-side TradingView websocket proxy (SSE).
 * The browser never talks to data.tradingview.com directly — Origin would fail.
 * REST snapshot is the first paint and a fallback if EventSource drops.
 */
export function useTradingViewTickers(): LiveTickerFeed {
  const [data, setData] = useState<GlobalTickersPayload>(emptyPayload);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;

    async function pullSnapshot() {
      try {
        const response = await fetch("/api/global-economy/tickers", { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok || !isPayload(payload)) {
          const message =
            typeof payload === "object" && payload !== null && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Ticker snapshot failed (${response.status})`;
          throw new Error(message);
        }
        if (cancelled) return;
        setData(payload);
        setError(payload.errors[0] ?? null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Ticker snapshot failed");
      }
    }

    function startPoll() {
      if (pollTimer != null) return;
      void pullSnapshot();
      pollTimer = window.setInterval(() => {
        if (!document.hidden) void pullSnapshot();
      }, 2000);
    }

    function stopPoll() {
      if (pollTimer == null) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    }

    void pullSnapshot();

    const source = new EventSource("/api/global-economy/tickers/stream");

    source.onopen = () => {
      stopPoll();
      setError(null);
    };

    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as
          | { type: "snapshot"; payload: GlobalTickersPayload }
          | { type: "tick"; ticker: GlobalTickerQuote };

        if (message.type === "snapshot") {
          setData(message.payload);
          setError(message.payload.errors[0] ?? null);
          return;
        }

        if (message.type === "tick") {
          setData((current) => ({
            source: "tradingview",
            asOf: new Date().toISOString(),
            errors: [],
            tickers: current.tickers.map((row) =>
              row.id === message.ticker.id ? message.ticker : row,
            ),
          }));
          setError(null);
        }
      } catch {
        setError("Ticker stream parse failed");
      }
    };

    source.onerror = () => {
      startPoll();
    };

    return () => {
      cancelled = true;
      stopPoll();
      source.close();
    };
  }, []);

  return { data, error };
}
