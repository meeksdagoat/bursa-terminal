"use client";

import { useEffect, useRef } from "react";

const TV_SINGLE_QUOTE_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";

const TV_TICKERS = [
  // CBOT:US10Y / TVC:US10Y are locked on the free embed ("only available on TradingView").
  // TVC:TNX is the CBOE 10-year yield and streams in the public widget.
  { symbol: "TVC:TNX", title: "US 10Y Yield" },
  { symbol: "FOREXCOM:SPXUSD", title: "S&P 500" },
  { symbol: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
  { symbol: "TVC:UKOIL", title: "Brent Crude" },
  { symbol: "TVC:GOLD", title: "Gold" },
] as const;

type TickerSpec = (typeof TV_TICKERS)[number];

function TradingViewSingleQuote({ ticker }: { ticker: TickerSpec }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

    const script = document.createElement("script");
    script.src = TV_SINGLE_QUOTE_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.text = JSON.stringify({
      symbol: ticker.symbol,
      width: "100%",
      colorTheme: "dark",
      theme: "dark",
      isTransparent: true,
      locale: "en",
    });

    container.append(widget, script);
    host.replaceChildren(container);

    return () => {
      host.replaceChildren();
    };
  }, [ticker.symbol]);

  return (
    <div
      ref={hostRef}
      className="min-h-[86px] w-full overflow-hidden bg-transparent [&_iframe]:block [&_iframe]:w-full"
      aria-label={`${ticker.title} live TradingView quote`}
    />
  );
}

/**
 * Official TradingView single-quote widgets. The vendor script reads JSON from
 * the script body and injects a live iframe — next/script cannot carry that payload.
 */
export function TradingViewTickers() {
  return (
    <div className="grid grid-cols-1 gap-px bg-neutral-800 sm:grid-cols-2 lg:grid-cols-5">
      {TV_TICKERS.map((ticker) => (
        <div key={ticker.symbol} className="bg-[#0a0a0a] px-1 pb-1 pt-1.5">
          <p className="px-1 pb-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-neutral-600">
            {ticker.title}
          </p>
          <TradingViewSingleQuote ticker={ticker} />
        </div>
      ))}
    </div>
  );
}
