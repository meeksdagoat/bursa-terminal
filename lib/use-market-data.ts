"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bursaTickSize, isBursaOpen, resolveFeedStatus, type FeedStatus } from "./market-status";
import type { Quote, QuotesPayload } from "./types";
import { useLiveData } from "./use-live-data";
import { useCoarsePointer } from "./use-media-query";

export type TickPulse = {
  dir: "up" | "down";
  at: number;
};

export type MarketData = {
  data: QuotesPayload | null;
  quotes: Quote[];
  quoteBySymbol: Map<string, Quote>;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
  latencyMs: number | null;
  refresh: () => void;
  status: FeedStatus;
  ticks: Record<string, TickPulse>;
  connected: boolean;
};

const LIVE_POLL_MS = 2_500;
const LIVE_POLL_TOUCH_MS = 5_000;
const CLOSED_POLL_MS = 60_000;
const TICK_MIN_MS = 2_000;
const TICK_MAX_MS = 3_000;
const TICK_MIN_TOUCH_MS = 4_500;
const TICK_MAX_TOUCH_MS = 6_000;
const MAX_DRIFT_PCT = 0.0035;

function cloneQuote(quote: Quote): Quote {
  return { ...quote };
}

function applyTick(quote: Quote, toward: Quote): Quote {
  const anchor = toward.price;
  const last = quote.price;
  if (anchor == null || last == null) return cloneQuote(toward);

  const size = bursaTickSize(anchor);
  const roll = Math.random();
  let next = last;

  if (roll < 0.55) {
    const steps = Math.random() < 0.18 ? 2 : 1;
    next = last + (Math.random() < 0.5 ? -steps : steps) * size;
  }

  const ceiling = anchor * (1 + MAX_DRIFT_PCT);
  const floor = anchor * (1 - MAX_DRIFT_PCT);
  next = Math.min(ceiling, Math.max(floor, next));
  next = Math.round(next / size) * size;
  if (next <= 0) next = last;

  const previous = quote.previousClose ?? toward.previousClose ?? next;
  const change = next - previous;
  const changePct = previous !== 0 ? (change / previous) * 100 : quote.changePct;

  const volumeBump =
    quote.volume != null && Math.random() < 0.45
      ? Math.round(quote.volume + Math.max(100, quote.volume * 0.0004 * Math.random()))
      : quote.volume;

  return {
    ...quote,
    price: Number(next.toFixed(4)),
    change: Number(change.toFixed(4)),
    changePct: changePct != null ? Number(changePct.toFixed(4)) : null,
    volume: volumeBump ?? quote.volume,
    dayHigh: quote.dayHigh != null ? Math.max(quote.dayHigh, next) : next,
    dayLow: quote.dayLow != null ? Math.min(quote.dayLow, next) : next,
    quoteTime: new Date().toISOString(),
  };
}

function tickQuotes(
  current: Quote[],
  anchors: Quote[],
): { quotes: Quote[]; pulses: Record<string, TickPulse> } {
  const byAnchor = new Map(anchors.map((quote) => [quote.symbol, quote]));
  const pulses: Record<string, TickPulse> = {};
  const quotes = current.map((quote) => {
    const anchor = byAnchor.get(quote.symbol);
    if (!anchor) return quote;
    const next = applyTick(quote, anchor);
    if (quote.price != null && next.price != null && next.price !== quote.price) {
      pulses[quote.symbol] = {
        dir: next.price > quote.price ? "up" : "down",
        at: Date.now(),
      };
    }
    return next;
  });
  return { quotes, pulses };
}

function rebasePulses(previous: Quote[], next: Quote[]): Record<string, TickPulse> {
  const prior = new Map(previous.map((quote) => [quote.symbol, quote.price]));
  const pulses: Record<string, TickPulse> = {};
  for (const quote of next) {
    const last = prior.get(quote.symbol);
    if (last == null || quote.price == null || quote.price === last) continue;
    pulses[quote.symbol] = {
      dir: quote.price > last ? "up" : "down",
      at: Date.now(),
    };
  }
  return pulses;
}

function collectQuotes(payload: QuotesPayload | null): Quote[] {
  if (!payload) return [];
  const rows = [...payload.quotes];
  if (payload.index && !rows.some((quote) => quote.symbol === payload.index?.symbol)) {
    rows.push(payload.index);
  }
  return rows;
}

function withLiveQuotes(payload: QuotesPayload | null, quotes: Quote[]): QuotesPayload | null {
  if (!payload) return null;
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  return {
    ...payload,
    quotes: payload.quotes.map((quote) => bySymbol.get(quote.symbol) ?? quote),
    index: payload.index
      ? (bySymbol.get(payload.index.symbol) ?? payload.index)
      : payload.index,
  };
}

/**
 * High-frequency market tape: polls Yahoo quotes and, during the Bursa session,
 * walks last, volume and % change every 2–3s so the watchlist and ribbon tick.
 */
export function useMarketData(symbols: string[]): MarketData {
  const live = isBursaOpen();
  const coarse = useCoarsePointer();
  const pollMs = live ? (coarse ? LIVE_POLL_TOUCH_MS : LIVE_POLL_MS) : CLOSED_POLL_MS;
  const quotesUrl = useMemo(() => {
    const list = [...new Set(symbols.filter((symbol) => symbol.length > 0))].sort();
    if (list.length === 0) return "/api/quotes?symbols=1155.KL";
    return `/api/quotes?symbols=${encodeURIComponent(list.join(","))}`;
  }, [symbols]);

  const feed = useLiveData<QuotesPayload>(quotesUrl, pollMs);
  const [displayQuotes, setDisplayQuotes] = useState<Quote[]>([]);
  const [ticks, setTicks] = useState<Record<string, TickPulse>>({});
  const anchorsRef = useRef<Quote[]>([]);
  const displayRef = useRef<Quote[]>([]);

  useEffect(() => {
    displayRef.current = displayQuotes;
  }, [displayQuotes]);

  useEffect(() => {
    const incoming = collectQuotes(feed.data);
    if (incoming.length === 0) return;

    const pulses = rebasePulses(displayRef.current, incoming);
    anchorsRef.current = incoming.map(cloneQuote);
    displayRef.current = incoming.map(cloneQuote);
    setDisplayQuotes(incoming.map(cloneQuote));
    if (Object.keys(pulses).length > 0) {
      setTicks((current) => ({ ...current, ...pulses }));
    }
  }, [feed.data]);

  useEffect(() => {
    if (!live || collectQuotes(feed.data).length === 0) return;

    let timer = 0;

    function schedule() {
      const min = coarse ? TICK_MIN_TOUCH_MS : TICK_MIN_MS;
      const max = coarse ? TICK_MAX_TOUCH_MS : TICK_MAX_MS;
      const wait = min + Math.random() * (max - min);
      timer = window.setTimeout(() => {
        if (document.hidden || !isBursaOpen()) {
          schedule();
          return;
        }
        const { quotes, pulses } = tickQuotes(displayRef.current, anchorsRef.current);
        displayRef.current = quotes;
        setDisplayQuotes(quotes);
        if (Object.keys(pulses).length > 0) {
          setTicks((current) => ({ ...current, ...pulses }));
        }
        schedule();
      }, wait);
    }

    schedule();
    return () => window.clearTimeout(timer);
  }, [live, feed.data?.asOf, quotesUrl, coarse]);

  const data = useMemo(
    () => withLiveQuotes(feed.data, displayQuotes.length > 0 ? displayQuotes : collectQuotes(feed.data)),
    [feed.data, displayQuotes],
  );

  const quotes = data?.quotes ?? [];
  const quoteBySymbol = useMemo(
    () => new Map(quotes.map((quote) => [quote.symbol, quote])),
    [quotes],
  );

  const connected = data != null;
  const status = resolveFeedStatus({
    marketState: data?.marketState ?? data?.index?.marketState,
    delayMinutes: data?.delayMinutes ?? data?.index?.delayMinutes,
    connected,
    error: feed.error,
    loading: feed.loading,
  });

  const refresh = useCallback(() => feed.refresh(), [feed]);

  return {
    data,
    quotes,
    quoteBySymbol,
    error: feed.error,
    loading: feed.loading,
    updatedAt: feed.updatedAt,
    latencyMs: feed.latencyMs,
    refresh,
    status,
    ticks,
    connected,
  };
}
