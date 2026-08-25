"use client";

import { useEffect, useRef } from "react";

const TV_TICKERS_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-tickers.js";

const TV_TICKERS_CONFIG = {
  symbols: [
    { proName: "CBOT:US10Y", title: "US 10Y Yield" },
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
    { proName: "TVC:UKOIL", title: "Brent Crude" },
    { proName: "TVC:GOLD", title: "Gold" },
  ],
  theme: "dark",
  colorTheme: "dark",
  isTransparent: true,
  locale: "en",
  showSymbolLogo: true,
};

/**
 * Official TradingView tickers widget. The vendor script reads JSON from the
 * script body and injects a live iframe — next/script cannot carry that payload.
 */
export function TradingViewTickers() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

    const script = document.createElement("script");
    script.src = TV_TICKERS_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.text = JSON.stringify(TV_TICKERS_CONFIG);

    container.append(widget, script);
    host.replaceChildren(container);

    return () => {
      host.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="w-full min-h-[72px] overflow-hidden bg-transparent [&_iframe]:block [&_iframe]:w-full"
      aria-label="Live TradingView market tickers"
    />
  );
}
