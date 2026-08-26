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
    container.className = "tradingview-widget-container relative h-full w-full overflow-hidden";
    container.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden;";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget relative h-full w-full";
    widget.style.cssText = "position:relative;width:100%;height:100%;";
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
    <section className="relative flex h-[400px] w-full min-w-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d] sm:h-[500px] lg:h-full lg:min-h-0">
      <header className="relative z-10 shrink-0 border-b border-neutral-800 p-3 sm:px-3 sm:py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          S&P 500 Heatmap
        </h3>
        <p className="mt-0.5 text-[10px] text-neutral-500">Sector grouping · TradingView live</p>
      </header>
      <div
        ref={hostRef}
        data-tv-heatmap
        className="relative isolate block h-full min-h-0 w-full flex-1 overflow-hidden bg-transparent [&_.tradingview-widget-container]:relative [&_.tradingview-widget-container]:h-full [&_.tradingview-widget-container]:w-full [&_.tradingview-widget-container]:overflow-hidden [&_.tradingview-widget-container__widget]:relative [&_.tradingview-widget-container__widget]:h-full [&_.tradingview-widget-container__widget]:w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:block [&_iframe]:!h-full [&_iframe]:!w-full [&_iframe]:max-h-full [&_iframe]:max-w-full [&_iframe]:border-0"
        aria-label="S&P 500 sector heatmap"
      />
    </section>
  );
}
