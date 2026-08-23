"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ChartStyle } from "@/components/price-chart";
import {
  changeClass,
  formatKlTime,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatRatio,
  formatVolume,
} from "@/lib/format";
import type { CandlesPayload, WatchlistRow } from "@/lib/types";
import { RANGE_KEYS, type RangeKey } from "@/lib/ranges";
import { SHARIAH_SOURCE } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";

const PriceChart = dynamic(() => import("@/components/price-chart"), {
  ssr: false,
  loading: () => <ChartMessage text="LOADING CHART" />,
});

const REFRESH_MS = 60 * 1000;

type ChartWidgetProps = {
  row: WatchlistRow;
};

export function ChartWidget({ row }: ChartWidgetProps) {
  const [range, setRange] = useState<RangeKey>("1M");
  const [style, setStyle] = useState<ChartStyle>("candles");

  const url = `/api/candles?symbol=${encodeURIComponent(row.symbol)}&range=${range}`;
  const { data, error } = useLiveData<CandlesPayload>(url, REFRESH_MS);

  // Payload can lag a click on another ticker or range by one render.
  const stale = data?.symbol !== row.symbol || data?.range !== range;
  const candles = useMemo(
    () => (data && data.symbol === row.symbol ? data.candles : []),
    [data, row.symbol],
  );
  const quote = row.quote;

  // Prefer the intraday move for short ranges so the chart and headline agree.
  const rangeChangePct = useMemo(() => {
    if (candles.length < 2) return null;
    const first = candles[0].open || candles[0].close;
    const last = candles[candles.length - 1].close;
    return first ? ((last - first) / first) * 100 : null;
  }, [candles]);

  const up = (quote?.changePct ?? rangeChangePct ?? 0) >= 0;

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-3 py-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-white">{row.name}</h2>
            <span className="font-mono text-[11px] text-neutral-500">{row.symbol}</span>
            <span
              title={SHARIAH_SOURCE}
              className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                row.shariah
                  ? "border-gain/40 bg-gain/10 text-gain"
                  : "border-neutral-600 bg-neutral-800 text-neutral-400"
              }`}
            >
              {row.shariah ? "Shariah" : "Non-Shariah"}
            </span>
            {quote?.marketState ? (
              <span className="font-mono text-[9px] text-neutral-600">{quote.marketState}</span>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-[22px] leading-none text-white">
              {formatPrice(quote?.price)}
            </span>
            <span className="text-[11px] text-neutral-500">{quote?.currency ?? "MYR"}</span>
            <span className={`font-mono text-[12px] ${changeClass(quote?.changePct)}`}>
              {formatPct(quote?.changePct)}
            </span>
            <span className="font-mono text-[9px] text-neutral-600">
              LAST {formatKlTime(quote?.quoteTime)} MYT
              {quote?.delayMinutes ? ` · ${quote.delayMinutes}M DELAY` : ""}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-4 gap-px border border-line bg-line">
          <Stat label="P/E" value={formatRatio(quote?.pe)} />
          <Stat label="Mkt Cap" value={formatMarketCap(quote?.marketCap)} />
          <Stat label="Div Yld" value={quote?.dividendYieldPct != null ? `${quote.dividendYieldPct.toFixed(1)}%` : "—"} />
          <Stat label="Volume" value={formatVolume(quote?.volume)} />
        </dl>
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-b border-line px-2">
        <div className="flex items-center gap-px">
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`px-2 py-0.5 font-mono text-[10px] tracking-wider transition-colors ${
                range === key
                  ? "bg-[#1f1f1f] text-amber-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {rangeChangePct != null ? (
            <span className={`font-mono text-[9px] ${changeClass(rangeChangePct)}`}>
              {range} {formatPct(rangeChangePct)}
            </span>
          ) : null}
          <div className="flex items-center gap-px">
            {(["candles", "line"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStyle(option)}
                className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  style === option
                    ? "bg-[#1f1f1f] text-amber-400"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative min-h-[150px] flex-1 bg-[#0a0a0a]">
        {error ? (
          <ChartMessage text={`CHART FEED ERROR · ${error}`} tone="error" />
        ) : candles.length === 0 ? (
          <ChartMessage text={stale ? "LOADING CHART" : "NO CANDLE DATA"} />
        ) : (
          <PriceChart
            candles={candles}
            style={style}
            intraday={data?.intraday ?? false}
            up={up}
          />
        )}

        <div className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[9px] text-neutral-700">
          YAHOO FINANCE · {data?.interval ?? "—"} · BURSA MAIN
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[92px] bg-panel px-3 py-1.5">
      <dt className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="font-mono text-[12px] text-neutral-100">{value}</dd>
    </div>
  );
}

function ChartMessage({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span
        className={`font-mono text-[10px] tracking-wider ${
          tone === "error" ? "text-loss" : "text-neutral-600"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
