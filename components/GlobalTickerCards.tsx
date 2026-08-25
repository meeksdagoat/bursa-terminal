"use client";

import { useEffect, useRef, useState } from "react";
import { GLOBAL_TICKER_SPECS } from "@/lib/global-ticker-catalog";
import { formatPct, formatPrice, formatYield } from "@/lib/format";
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
    <div data-tape="native">
      {feed.error ? (
        <p className="border-b border-neutral-800 px-3 py-1.5 font-mono text-[10px] text-loss">
          TICKER FEED · {feed.error}
        </p>
      ) : null}

      <div className="grid min-w-0 grid-cols-2 gap-2 p-2 sm:grid-cols-2 sm:p-3 lg:grid-cols-3 lg:p-3 xl:grid-cols-5">
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
      ? "text-neutral-500"
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
    flash === "up" ? "text-emerald-400" : flash === "down" ? "text-rose-400" : "text-white";

  return (
    <article
      className={`flex min-w-0 flex-col gap-2 overflow-hidden border p-3 transition-colors duration-300 last:col-span-2 lg:last:col-span-1 ${flashClass}`}
      aria-label={`${ticker?.label ?? fallbackLabel} live quote`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-neutral-500">
          {ticker?.label ?? fallbackLabel}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[8px] tracking-wider text-emerald-400">
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          </span>
          LIVE
        </span>
      </div>

      <p
        className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-2xl font-bold leading-none tracking-tight tabular-nums xl:text-xl 2xl:text-2xl ${priceTone}`}
        aria-live="polite"
        title={formatPrint(ticker)}
      >
        {formatPrint(ticker)}
      </p>

      <div
        className={`flex min-w-0 flex-col gap-0.5 font-mono text-[10px] leading-tight sm:flex-row sm:items-center sm:gap-2 sm:text-xs xl:flex-col xl:items-stretch xl:gap-0.5 xl:text-[10px] 2xl:flex-row 2xl:items-center 2xl:gap-2 2xl:text-xs ${changeTone}`}
      >
        <span className="min-w-0 truncate">
          {ticker?.symbol ?? "—"} · {ticker?.unit ?? "—"}
        </span>
        <span className="shrink-0 tabular-nums">{formatPct(change)}</span>
      </div>
    </article>
  );
}
