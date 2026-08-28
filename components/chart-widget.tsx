"use client";

import dynamic from "next/dynamic";
import { memo, useMemo, useState } from "react";
import { Jargon } from "@/components/jargon-term";
import { SignedPct } from "@/components/signed-change";
import { TapHint } from "@/components/tap-hint";
import {
  EMPTY_OVERLAYS,
  type ChartOverlays,
  type DrawingTool,
} from "@/lib/chart-ui";
import {
  formatKlTime,
  formatMarketCap,
  formatPrice,
  formatRatio,
} from "@/lib/format";
import type { JargonTerm } from "@/lib/jargon";
import {
  CHART_TIMEFRAMES,
  CHART_TYPES,
  chartTimeframeRequest,
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

const CHART_TYPE_SHORT: Record<ChartType, string> = {
  candlestick: "Candle",
  line: "Line",
  "heikin-ashi": "HA",
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
  const [freeMove, setFreeMove] = useState(false);
  const quote = row.quote;
  const priceFlash = usePriceFlash(row.symbol, ticks);

  const candleQuery = chartTimeframeRequest(timeframe);
  const url = `/api/candles?symbol=${encodeURIComponent(row.symbol)}&${candleQuery.param}=${candleQuery.value}`;
  const { data, error } = useLiveData<CandlesPayload>(url, REFRESH_MS);

  const payloadMatches =
    data != null &&
    data.symbol === row.symbol &&
    (data.range === candleQuery.value || data.interval === candleQuery.value);
  const stale = !payloadMatches;
  const candles = useMemo(() => {
    const raw = payloadMatches && data ? data.candles : [];
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
  }, [data, payloadMatches, quote?.price]);

  const rangeChangePct = useMemo(() => {
    if (candles.length < 2) return null;
    const first = candles[0].open || candles[0].close;
    const last = candles[candles.length - 1].close;
    return first ? ((last - first) / first) * 100 : null;
  }, [candles]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <div className="border-b border-line">
        <div className="flex flex-col gap-1.5 px-3 py-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-[13px] font-semibold tracking-tight text-white">{row.name}</h2>
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
              <span className={`rounded-sm px-1 font-mono text-[17px] leading-none text-white ${priceFlash}`}>
                {formatPrice(quote?.price)}
              </span>
              <span className="text-[11px] text-neutral-500">{quote?.currency ?? "MYR"}</span>
              <SignedPct value={quote?.changePct} className="font-mono text-[11px]" />
              <span className="font-mono text-[9px] text-neutral-600">
                LAST {formatKlTime(quote?.quoteTime)} MYT
                {quote?.delayMinutes ? ` · ${quote.delayMinutes}M DELAY` : ""}
              </span>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-col items-start gap-1.5 sm:w-auto sm:min-w-0 sm:flex-1 sm:items-end">
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
            <dl
              id="chart-metrics-row"
              className="flex w-full min-w-0 flex-nowrap items-stretch gap-px overflow-hidden border border-line bg-line"
            >
              <Stat label="P/E" term="pe" value={formatRatio(quote?.pe)} />
              <Stat label="Mkt Cap" term="marketCap" value={formatMarketCap(quote?.marketCap)} />
              <Stat
                label="Div Yld"
                term="dividendYield"
                value={quote?.dividendYieldPct != null ? `${quote.dividendYieldPct.toFixed(1)}%` : "—"}
              />
              <WeekRangeBar
                low={quote?.yearLow ?? null}
                high={quote?.yearHigh ?? null}
                last={quote?.price ?? null}
              />
            </dl>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-line px-2 py-1">
        <div className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-none">
          <ChartToolbarSelect
            id="chart-timeframe"
            label="Timeframe"
            value={timeframe}
            title={
              timeframe === "1H"
                ? "60-minute candles"
                : timeframe === "4H"
                  ? "240-minute candles"
                  : "Chart timeframe"
            }
            options={CHART_TIMEFRAMES.map((key) => ({ value: key, label: key }))}
            onChange={setTimeframe}
          />
          <ChartToolbarSelect
            id="chart-type"
            label="Chart type"
            value={chartType}
            options={CHART_TYPES.map((key) => ({
              value: key,
              label: CHART_TYPE_SHORT[key],
            }))}
            onChange={setChartType}
          />
          <ChartToolbarSelect
            id="chart-scale-mode"
            label="Scale mode"
            value={freeMove ? "free" : "auto"}
            title={
              freeMove
                ? "Free pan and manual price scale"
                : "Fit price scale to data"
            }
            options={[
              { value: "auto", label: "Auto Scale" },
              { value: "free", label: "Free Move" },
            ]}
            onChange={(mode) => setFreeMove(mode === "free")}
          />
        </div>

        {rangeChangePct != null ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] whitespace-nowrap text-zinc-400">
            {timeframe}
            <SignedPct value={rangeChangePct} />
          </span>
        ) : null}
      </div>

      <div className="no-scrollbar flex flex-nowrap items-center gap-x-3 overflow-x-auto overscroll-x-contain border-b border-line px-2 py-1 touch-pan-x scrollbar-none">
        {OVERLAY_TOGGLES.map((item) => (
          <label
            key={item.id}
            className="flex shrink-0 cursor-pointer items-center gap-1 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500"
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

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#0a0a0a] touch-pan-y max-lg:h-[40vh] max-lg:min-h-[280px] max-lg:max-h-[380px] max-lg:flex-none max-lg:overscroll-y-auto lg:min-h-0 lg:overscroll-none">
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
                freeMove={freeMove}
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
            YAHOO FINANCE · {timeframe} · BURSA MAIN
          </div>
        </div>
      </div>
    </section>
  );
}

function ChartToolbarSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  title,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  title?: string;
}) {
  return (
    <div className="relative shrink-0">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        title={title ?? label}
        onChange={(event) => onChange(event.target.value as T)}
        className="appearance-none rounded-sm border border-line bg-[#0d0d0d] py-1 pr-5 pl-2 font-mono text-xs whitespace-nowrap text-neutral-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 font-mono text-[8px] text-neutral-500"
        aria-hidden
      >
        ▾
      </span>
    </div>
  );
}

function Stat({ label, term, value }: { label: string; term: JargonTerm; value: string }) {
  return (
    <div className="shrink-0 bg-panel px-1.5 py-1 sm:min-w-[84px] sm:px-2 sm:py-1">
      <dt className="text-[9px] uppercase tracking-wider text-neutral-500">
        <Jargon term={term} align="right" className="min-h-0! sm:min-h-0">
          {label}
        </Jargon>
      </dt>
      <dd className="font-mono text-[11px] whitespace-nowrap text-neutral-100">{value}</dd>
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
    <div id="chart-week-range" className="flex min-w-0 flex-1 flex-col justify-center bg-panel px-1.5 py-1 sm:px-2 sm:py-1">
      <dt className="text-[9px] uppercase tracking-wider text-neutral-500">
        <Jargon term="week52" align="right" className="min-h-0!">
          52W Range
        </Jargon>
      </dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-1 font-mono text-[10px] tabular-nums whitespace-nowrap text-neutral-400">
        <span className="shrink-0">{formatPrice(low)}</span>
        <div className="relative h-1 min-w-[1.25rem] flex-1 rounded-sm bg-[#1f1f1f] sm:h-1.5">
          {ready ? (
            <span
              className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 bg-amber-400 sm:h-2.5"
              style={{ left: `${pct}%` }}
            />
          ) : null}
        </div>
        <span className="shrink-0">{formatPrice(high)}</span>
      </dd>
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
