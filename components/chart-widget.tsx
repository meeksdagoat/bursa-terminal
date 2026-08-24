"use client";

import dynamic from "next/dynamic";
import { memo, useMemo, useState } from "react";
import { HScroll } from "@/components/h-scroll";
import { Jargon } from "@/components/jargon-term";
import { TapHint } from "@/components/tap-hint";
import {
  EMPTY_OVERLAYS,
  type ChartOverlays,
  type DrawingTool,
} from "@/lib/chart-ui";
import {
  changeClass,
  formatKlTime,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatRatio,
} from "@/lib/format";
import type { JargonTerm } from "@/lib/jargon";
import {
  CHART_TIMEFRAMES,
  CHART_TYPES,
  type ChartTimeframe,
  type ChartType,
} from "@/lib/ranges";
import type { CandlesPayload, WatchlistRow } from "@/lib/types";
import { SHARIAH_SOURCE } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import type { TickPulse } from "@/lib/use-market-data";
import { usePriceFlash } from "@/lib/use-price-flash";

const StockCandlestickChart = dynamic(
  () =>
    import("@/components/stock-candlestick-chart").then((mod) => mod.StockCandlestickChart),
  {
    ssr: false,
    loading: () => <ChartMessage text="LOADING CHART" />,
  },
);

const REFRESH_MS = 15 * 1000;

const CHART_TYPE_LABEL: Record<ChartType, string> = {
  candlestick: "Candlestick",
  line: "Line",
  "heikin-ashi": "Heikin-Ashi",
};

const TOOLS: { id: DrawingTool; label: string; title: string }[] = [
  { id: "cursor", label: "↖", title: "Cursor" },
  { id: "trendline", label: "/", title: "Trendline" },
  { id: "hline", label: "—", title: "Horizontal support / resistance" },
  { id: "fib", label: "Fib", title: "Fibonacci retracement" },
];

const OVERLAY_TOGGLES: { id: keyof ChartOverlays; label: string }[] = [
  { id: "sma20", label: "SMA 20" },
  { id: "sma50", label: "SMA 50" },
  { id: "sma200", label: "SMA 200" },
  { id: "ema", label: "EMA" },
  { id: "volumeProfile", label: "Vol profile" },
  { id: "rsi", label: "RSI" },
  { id: "macd", label: "MACD" },
];

type ChartWidgetProps = {
  row: WatchlistRow;
  saved: boolean;
  onToggleSave: (symbol: string) => void;
  ticks?: Record<string, TickPulse>;
};

function ChartWidgetInner({ row, saved, onToggleSave, ticks = {} }: ChartWidgetProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1D");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [overlays, setOverlays] = useState<ChartOverlays>(EMPTY_OVERLAYS);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("cursor");
  const quote = row.quote;
  const priceFlash = usePriceFlash(row.symbol, ticks);

  const url = `/api/candles?symbol=${encodeURIComponent(row.symbol)}&range=${timeframe}`;
  const { data, error } = useLiveData<CandlesPayload>(url, REFRESH_MS);

  const stale = data?.symbol !== row.symbol || data?.range !== timeframe;
  const candles = useMemo(() => {
    const raw =
      data && data.symbol === row.symbol && data.range === timeframe ? data.candles : [];
    const last = quote?.price;
    if (raw.length === 0 || last == null) return raw;
    const tail = raw[raw.length - 1];
    return [
      ...raw.slice(0, -1),
      {
        ...tail,
        close: last,
        high: Math.max(tail.high, last),
        low: Math.min(tail.low, last),
      },
    ];
  }, [data, row.symbol, timeframe, quote?.price]);

  const rangeChangePct = useMemo(() => {
    if (candles.length < 2) return null;
    const first = candles[0].open || candles[0].close;
    const last = candles[candles.length - 1].close;
    return first ? ((last - first) / first) * 100 : null;
  }, [candles]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex flex-col gap-3 border-b border-line px-3 py-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-white">{row.name}</h2>
            <span className="font-mono text-[11px] text-neutral-500">{row.symbol}</span>
            {quote?.marketState ? (
              <span className="font-mono text-[9px] text-neutral-600">{quote.marketState}</span>
            ) : null}
            <button
              type="button"
              onClick={() => onToggleSave(row.symbol)}
              aria-pressed={saved}
              title={saved ? "Remove from watchlist" : "Save to watchlist"}
              className={`min-h-11 rounded-sm border px-3 py-0.5 font-mono text-[10px] tracking-wider transition-colors md:min-h-0 md:px-1.5 md:text-[9px] ${
                saved
                  ? "border-gain/50 bg-gain/10 text-gain hover:border-loss/50 hover:text-loss"
                  : "border-line text-neutral-500 hover:border-gain/40 hover:text-gain"
              }`}
            >
              {saved ? "★ IN WATCHLIST" : "☆ SAVE"}
            </button>
          </div>

          <div className="mt-0.5 flex items-baseline gap-2">
            <span className={`rounded-sm px-1 font-mono text-[22px] leading-none text-white ${priceFlash}`}>
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

        <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
          <TapHint text={SHARIAH_SOURCE} title="Screening" align="right">
            <span
              className={`rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                row.shariah
                  ? "border-amber-400/50 bg-gain/15 text-gain shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                  : "border-neutral-600 bg-neutral-800 text-neutral-400"
              }`}
            >
              {row.shariah ? "Shariah compliant" : "Non-Shariah"}
            </span>
          </TapHint>
          <dl className="grid grid-cols-3 gap-px border border-line bg-line">
            <Stat label="P/E" term="pe" value={formatRatio(quote?.pe)} />
            <Stat label="Mkt Cap" term="marketCap" value={formatMarketCap(quote?.marketCap)} />
            <Stat
              label="Div Yld"
              term="dividendYield"
              value={quote?.dividendYieldPct != null ? `${quote.dividendYieldPct.toFixed(1)}%` : "—"}
            />
          </dl>
        </div>
      </div>

      <WeekRangeBar
        low={quote?.yearLow ?? null}
        high={quote?.yearHigh ?? null}
        last={quote?.price ?? null}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5">
        <HScroll className="min-w-0 items-center gap-px">
          {CHART_TIMEFRAMES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTimeframe(key)}
              className={`min-h-11 min-w-11 shrink-0 snap-start px-1.5 font-mono text-[11px] tracking-wider transition-colors md:min-h-0 md:min-w-0 md:py-0.5 md:text-[10px] ${
                timeframe === key
                  ? "bg-[#1f1f1f] text-amber-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {key}
            </button>
          ))}
        </HScroll>

        <span className="hidden h-4 w-px bg-line sm:block" />

        <HScroll className="min-w-0 items-center gap-px">
          {CHART_TYPES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setChartType(key)}
              className={`min-h-11 shrink-0 snap-start px-1.5 font-mono text-[10px] tracking-wider md:min-h-0 md:py-0.5 ${
                chartType === key
                  ? "bg-[#1f1f1f] text-amber-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {CHART_TYPE_LABEL[key]}
            </button>
          ))}
        </HScroll>

        {rangeChangePct != null ? (
          <span className={`ml-auto font-mono text-[9px] ${changeClass(rangeChangePct)}`}>
            {timeframe} {formatPct(rangeChangePct)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-2 py-1">
        {OVERLAY_TOGGLES.map((item) => (
          <label
            key={item.id}
            className="flex min-h-11 cursor-pointer items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500 md:min-h-0"
          >
            <input
              type="checkbox"
              checked={overlays[item.id]}
              onChange={() =>
                setOverlays((current) => ({ ...current, [item.id]: !current[item.id] }))
              }
              className="accent-gain"
            />
            {item.label}
          </label>
        ))}
      </div>

        <div className="relative flex min-h-[180px] flex-1 overflow-hidden overscroll-none bg-[#0a0a0a] max-lg:h-[40vh] max-lg:min-h-[280px] max-lg:max-h-[380px] max-lg:flex-none">
        <div className="z-20 flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line bg-[#101010] py-2 md:w-9">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.title}
              aria-pressed={drawingTool === tool.id}
              onClick={() => setDrawingTool(tool.id)}
              className={`flex min-h-11 min-w-11 items-center justify-center border font-mono text-[10px] md:h-8 md:w-8 md:min-h-0 md:min-w-0 ${
                drawingTool === tool.id
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                  : "border-transparent text-neutral-500 hover:border-line hover:text-neutral-200"
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-0 min-w-0 flex-1">
          {error ? (
            <ChartMessage text={`CHART FEED ERROR · ${error}`} tone="error" />
          ) : (
            <>
              <StockCandlestickChart
                candles={candles}
                chartType={chartType}
                overlays={overlays}
                drawingTool={drawingTool}
                onDrawingComplete={() => setDrawingTool("cursor")}
              />
              {candles.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
                  <span className="font-mono text-[10px] tracking-wider text-neutral-600">
                    {stale ? "LOADING CHART" : "NO CANDLE DATA"}
                  </span>
                </div>
              ) : null}
            </>
          )}

          <div className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[9px] text-neutral-700">
            YAHOO FINANCE · {data?.range ?? timeframe} · BURSA MAIN
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, term, value }: { label: string; term: JargonTerm; value: string }) {
  return (
    <div className="min-w-[92px] bg-panel px-3 py-1.5">
      <dt className="text-[9px] uppercase tracking-wider text-neutral-500">
        <Jargon term={term} align="right">
          {label}
        </Jargon>
      </dt>
      <dd className="font-mono text-[12px] text-neutral-100">{value}</dd>
    </div>
  );
}

function WeekRangeBar({
  low,
  high,
  last,
}: {
  low: number | null;
  high: number | null;
  last: number | null;
}) {
  const ready = low != null && high != null && last != null && high > low;
  const pct = ready ? Math.min(100, Math.max(0, ((last - low) / (high - low)) * 100)) : 50;

  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-1.5">
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
        <Jargon term="week52">52W</Jargon>
      </span>
      <span className="w-12 shrink-0 font-mono text-[10px] text-neutral-400">{formatPrice(low)}</span>
      <div className="relative h-1.5 min-w-0 flex-1 rounded-sm bg-[#1f1f1f]">
        {ready ? (
          <span
            className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-amber-400"
            style={{ left: `${pct}%` }}
          />
        ) : null}
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-neutral-400">
        {formatPrice(high)}
      </span>
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

function sameTick(
  a: Record<string, TickPulse> | undefined,
  b: Record<string, TickPulse> | undefined,
  symbol: string,
) {
  return a?.[symbol]?.at === b?.[symbol]?.at && a?.[symbol]?.dir === b?.[symbol]?.dir;
}

export const ChartWidget = memo(ChartWidgetInner, (prev, next) => {
  const a = prev.row;
  const b = next.row;
  return (
    prev.saved === next.saved &&
    prev.onToggleSave === next.onToggleSave &&
    a.symbol === b.symbol &&
    a.name === b.name &&
    a.shariah === b.shariah &&
    a.quote?.price === b.quote?.price &&
    a.quote?.changePct === b.quote?.changePct &&
    a.quote?.pe === b.quote?.pe &&
    a.quote?.marketCap === b.quote?.marketCap &&
    a.quote?.dividendYieldPct === b.quote?.dividendYieldPct &&
    a.quote?.yearLow === b.quote?.yearLow &&
    a.quote?.yearHigh === b.quote?.yearHigh &&
    a.quote?.quoteTime === b.quote?.quoteTime &&
    a.quote?.marketState === b.quote?.marketState &&
    sameTick(prev.ticks, next.ticks, a.symbol)
  );
});
