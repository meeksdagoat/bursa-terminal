"use client";

import { useEffect, useRef } from "react";

const TV_HEATMAP_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";

const HEATMAP_CONFIG = {
  exchanges: [] as string[],
  // TradingView's official S&P 500 heatmap universe id is SPX500.
  dataSource: "SPX500",
  grouping: "sector",
  blockSize: "market_cap_basic",
  blockColor: "change",
  locale: "en",
  colorTheme: "dark",
  theme: "dark",
  isTransparent: true,
  hasTopBar: false,
  isDataSetEnabled: false,
  isZoomEnabled: true,
  hasSymbolTooltip: true,
  width: "100%",
  height: "100%",
};

export function GlobalMarketHeatmap() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.append(widget);
    host.replaceChildren(container);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const script = document.createElement("script");
      script.src = TV_HEATMAP_SRC;
      script.type = "text/javascript";
      script.async = true;
      script.text = JSON.stringify(HEATMAP_CONFIG);
      container.append(script);
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      host.replaceChildren();
    };
  }, []);

  return (
    <section className="flex h-auto min-w-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d] lg:h-full lg:min-h-0">
      <header className="shrink-0 border-b border-neutral-800 p-3 sm:px-3 sm:py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          S&P 500 Heatmap
        </h3>
        <p className="mt-0.5 text-[10px] text-neutral-500">Sector grouping · TradingView live</p>
      </header>
      <div
        ref={hostRef}
        data-tv-heatmap
        className="min-h-[180px] w-full flex-1 overflow-hidden bg-transparent sm:min-h-[220px] [&_.tradingview-widget-container]:h-full [&_.tradingview-widget-container]:w-full [&_.tradingview-widget-container__widget]:h-full [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full"
        aria-label="S&P 500 sector heatmap"
      />
    </section>
  );
}
