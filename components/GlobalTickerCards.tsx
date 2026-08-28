"use client";

import { useEffect, useRef, useState } from "react";
import { GLOBAL_TICKER_SPECS } from "@/lib/global-ticker-catalog";
import { formatPct, formatPrice, formatYield } from "@/lib/format";
import {
  geCardShell,
  geLiveBadge,
  geMeta,
  gePrimaryMetric,
  geSectionHeader,
} from "@/lib/global-economy-ui";
import type { GlobalTickerQuote } from "@/lib/types";
import { useTradingViewTickers } from "@/lib/use-tradingview-tickers";

const FLASH_MS = 600;

type Flash = "up" | "down" | null;

function formatPrint(ticker: GlobalTickerQuote | null): string {
  if (!ticker || ticker.price == null) return "—";
  if (ticker.kind === "yield") return formatYield(ticker.price);
  return formatPrice(ticker.price);
}

/**
 * Native Global Economy tape. Dark DOM cards only — never mounts TradingView
 * quote iframes or white-background widgets.
 */
export function GlobalTickerCards() {
  const feed = useTradingViewTickers();
  const byId = new Map(feed.data.tickers.map((row) => [row.id, row]));

  return (
    <div data-tape="native" className="min-w-0">
      {feed.error ? (
        <p className="border-b border-neutral-800 px-2 py-1 font-mono text-[10px] text-loss">
          TICKER FEED · {feed.error}
        </p>
      ) : null}

      <div className="grid min-w-0 grid-cols-2 gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {GLOBAL_TICKER_SPECS.map((spec) => (
          <TickerCard
            key={spec.id}
            ticker={byId.get(spec.id) ?? null}
            fallbackLabel={spec.label}
          />
        ))}
      </div>
    </div>
  );
}

function TickerCard({
  ticker,
  fallbackLabel,
}: {
  ticker: GlobalTickerQuote | null;
  fallbackLabel: string;
}) {
  const [flash, setFlash] = useState<Flash>(null);
  const previousPrice = useRef<number | null>(null);
  const currentPrice = ticker?.price ?? null;

  useEffect(() => {
    const previous = previousPrice.current;
    if (currentPrice != null && previous != null && currentPrice !== previous) {
      setFlash(currentPrice > previous ? "up" : "down");
      const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
      previousPrice.current = currentPrice;
      return () => window.clearTimeout(timer);
    }
    if (currentPrice != null) previousPrice.current = currentPrice;
  }, [currentPrice]);

  const change = ticker?.changePct ?? null;
  const changeTone =
    change == null || change === 0
      ? "text-zinc-400"
      : change > 0
        ? "text-emerald-400"
        : "text-rose-400";

  const flashClass =
    flash === "up"
      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
      : flash === "down"
        ? "border-rose-500/50 bg-rose-500/20 text-rose-400"
        : "border-neutral-800 bg-[#0d0d0d]";

  const priceTone =
    flash === "up" ? "text-emerald-400" : flash === "down" ? "text-rose-400" : "text-zinc-100";

  return (
    <article
      className={`flex min-w-0 flex-col gap-1 overflow-hidden border transition-colors duration-300 last:col-span-2 lg:last:col-span-1 ${geCardShell} ${flashClass}`}
      aria-label={`${ticker?.label ?? fallbackLabel} live quote`}
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <p className={`${geSectionHeader} mb-0 min-w-0 truncate font-semibold normal-case tracking-[0.12em] text-zinc-500`}>
          {ticker?.label ?? fallbackLabel}
        </p>
        <span className={`${geLiveBadge} font-mono`}>
          <span className="relative mr-0.5 inline-flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          LIVE
        </span>
      </div>

      <p className={`${gePrimaryMetric} ${priceTone}`} aria-live="polite" title={formatPrint(ticker)}>
        {formatPrint(ticker)}
      </p>

      <div className={`flex min-w-0 items-center gap-1.5 font-mono ${changeTone}`}>
        <span className={`${geMeta} font-mono`}>
          {ticker?.symbol ?? "—"} · {ticker?.unit ?? "—"}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums">{formatPct(change)}</span>
      </div>
    </article>
  );
}
