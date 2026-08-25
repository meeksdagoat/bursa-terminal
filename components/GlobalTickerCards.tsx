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

export function GlobalTickerCards() {
  const feed = useTradingViewTickers();
  const byId = new Map(feed.data.tickers.map((row) => [row.id, row]));

  return (
    <div>
      {feed.error ? (
        <p className="border-b border-neutral-800 px-3 py-1.5 font-mono text-[10px] text-loss">
          TICKER FEED · {feed.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-5">
        {GLOBAL_TICKER_SPECS.map((spec) => (
          <TickerCard key={spec.id} ticker={byId.get(spec.id) ?? null} fallbackLabel={spec.label} />
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
      className={`border px-3 py-2.5 transition-colors duration-300 ${flashClass}`}
      aria-label={`${ticker?.label ?? fallbackLabel} live quote`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
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

      <p className={`mt-1.5 font-mono text-2xl leading-none tabular-nums ${priceTone}`} aria-live="polite">
        {formatPrint(ticker)}
      </p>

      <p className={`mt-1.5 text-xs font-mono ${changeTone}`}>
        {ticker?.symbol ?? "—"} · {ticker?.unit ?? "—"} · {formatPct(change)}
      </p>
    </article>
  );
}
