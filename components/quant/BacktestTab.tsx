"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TargetSymbolCombobox } from "@/components/quant-hub/TargetSymbolCombobox";
import {
  BACKTEST_LOOKBACKS,
  BACKTEST_STRATEGIES,
  SP500_BENCHMARK_SYMBOL,
  lookbackFetchCalendarDays,
  prepareBacktestData,
  runBacktest,
  type BacktestEquityPoint,
  type BacktestLookbackId,
  type BacktestResult,
  type BacktestSignal,
  type BacktestStrategyId,
} from "@/lib/quant/backtest";
import type { HistoryPayload } from "@/lib/types";

const PANEL = "rounded border border-neutral-800 bg-[#0d0d0d] p-3";
const TAB_PILL_ACTIVE = "border-amber-500/50 bg-amber-500/15 text-amber-400";
const TAB_PILL_IDLE =
  "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300";

function historyFromDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchHistory(symbols: string[], from: string): Promise<HistoryPayload> {
  const response = await fetch(
    `/api/history?symbols=${encodeURIComponent(symbols.join(","))}&from=${from}`,
  );
  const body = (await response.json()) as HistoryPayload | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
  }
  return body as HistoryPayload;
}

type BacktestTabProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function BacktestTab({ symbol, onSymbolChange }: BacktestTabProps) {
  const [strategy, setStrategy] = useState<BacktestStrategyId>("rsi_mean_reversion_14");
  const [lookback, setLookback] = useState<BacktestLookbackId>("3y");
  const [initialCapital, setInitialCapital] = useState(10_000);
  const [stopLossPct, setStopLossPct] = useState(8);
  const [takeProfitPct, setTakeProfitPct] = useState(15);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockNotice, setMockNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMockNotice(null);

    const fetchDays = lookbackFetchCalendarDays(lookback);
    const from = historyFromDate(fetchDays);

    void fetchHistory([symbol, SP500_BENCHMARK_SYMBOL], from)
      .then((body) => {
        if (cancelled) return;

        const stockPoints = body.series[symbol] ?? [];
        const sp500Points = body.series[SP500_BENCHMARK_SYMBOL] ?? [];
        const { aligned, usedMockData } = prepareBacktestData({
          symbol,
          stockPoints,
          benchmarkPoints: [],
          sp500Points,
          lookback,
        });

        const backtest = runBacktest({
          aligned,
          lookback,
          strategy,
          initialCapital,
          stopLossPct,
          takeProfitPct,
          usedMockData,
        });

        setResult(backtest);
        setMockNotice(
          usedMockData
            ? "Live history incomplete — running on seeded GBM synthetic series so the engine always renders."
            : body.errors.length > 0
              ? `Partial live feed: ${body.errors.slice(0, 1).join("")}`
              : null,
        );
      })
      .catch(() => {
        if (cancelled) return;

        const { aligned, usedMockData } = prepareBacktestData({
          symbol,
          stockPoints: [],
          benchmarkPoints: [],
          sp500Points: [],
          lookback,
        });

        setResult(
          runBacktest({
            aligned,
            lookback,
            strategy,
            initialCapital,
            stopLossPct,
            takeProfitPct,
            usedMockData: true,
          }),
        );
        setMockNotice("History request failed — displaying seeded synthetic backtest data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, strategy, lookback, initialCapital, stopLossPct, takeProfitPct]);

  const signalByDate = useMemo(() => {
    const map = new Map<string, BacktestSignal>();
    for (const signal of result?.signals ?? []) map.set(signal.date, signal);
    return map;
  }, [result?.signals]);

  return (
    <section className={`flex flex-col gap-3 ${PANEL}`}>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Target Stock
          </span>
          <TargetSymbolCombobox value={symbol} onChange={onSymbolChange} />
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Strategy
          </span>
          <select
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as BacktestStrategyId)}
            className="rounded border border-neutral-800 bg-[#111111] px-2 py-1.5 font-mono text-xs text-neutral-200 outline-none focus:border-amber-400/40"
          >
            {BACKTEST_STRATEGIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <fieldset className="flex flex-wrap gap-1.5">
          {BACKTEST_LOOKBACKS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLookback(option.id)}
              className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                lookback === option.id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Capital (RM)
          </span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={initialCapital}
            onChange={(event) => setInitialCapital(Number(event.target.value) || 10_000)}
            className="w-28 rounded border border-neutral-800 bg-[#111111] px-2 py-1 font-mono text-xs text-neutral-200 outline-none focus:border-amber-400/40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Stop-Loss %
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={stopLossPct}
            onChange={(event) => setStopLossPct(Number(event.target.value) || 0)}
            className="w-20 rounded border border-neutral-800 bg-[#111111] px-2 py-1 font-mono text-xs text-neutral-200 outline-none focus:border-amber-400/40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Take-Profit %
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={takeProfitPct}
            onChange={(event) => setTakeProfitPct(Number(event.target.value) || 0)}
            className="w-20 rounded border border-neutral-800 bg-[#111111] px-2 py-1 font-mono text-xs text-neutral-200 outline-none focus:border-amber-400/40"
          />
        </label>
      </div>

      {mockNotice ? (
        <p className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1 font-mono text-[10px] text-amber-400">
          {mockNotice}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded border border-neutral-800 bg-[#111111]" />
          ))}
        </div>
      ) : result ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ReturnsMetricCard
              strategyReturnPct={result.metrics.totalReturnPct}
              klciReturnPct={result.metrics.benchmarkReturnPct}
              sp500ReturnPct={result.metrics.sp500ReturnPct}
            />
            <MetricCard
              title="Trade Stats"
              primary={`Win Rate ${result.metrics.winRatePct.toFixed(1)}%`}
              secondary={`${result.metrics.totalTrades} closed trades`}
            />
            <MetricCard
              title="Profit Factor"
              primary={result.metrics.profitFactor.toFixed(2)}
              secondary="Gross profit / gross loss"
              primaryTone="text-amber-400"
            />
            <MetricCard
              title="Risk"
              primary={`Max DD ${result.metrics.maxDrawdownPct.toFixed(2)}%`}
              secondary={`Sharpe ${result.metrics.sharpeRatio.toFixed(2)}`}
              primaryTone="text-rose-400"
            />
          </div>

          <div className="flex h-[380px] flex-col rounded border border-neutral-800 bg-[#111111] p-2">
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-amber-500" aria-hidden />
                Strategy
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-neutral-500" aria-hidden />
                FBM KLCI
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-0.5 w-3 border-t border-dashed border-purple-500"
                  aria-hidden
                />
                S&P 500
              </span>
            </div>
            <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={result.equityCurve} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => String(value).slice(5)}
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(value) => `RM ${(Number(value) / 1000).toFixed(1)}k`}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  width={58}
                />
                <Tooltip content={<EquityTooltip signalByDate={signalByDate} />} />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="FBM KLCI"
                  stroke="#6b7280"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="sp500Equity"
                  name="S&P 500"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="strategy"
                  name="Strategy"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                {result.equityCurve.map((point) => {
                  const signal = signalByDate.get(point.date);
                  if (!signal) return null;
                  return (
                    <ReferenceDot
                      key={`${point.date}-${signal.type}`}
                      x={point.date}
                      y={point.strategy}
                      r={5}
                      fill={signal.type === "buy" ? "#4ade80" : "#f87171"}
                      stroke="#0d0d0d"
                      strokeWidth={1}
                      label={{
                        value: signal.type === "buy" ? "▲" : "▼",
                        position: "top",
                        fill: signal.type === "buy" ? "#4ade80" : "#f87171",
                        fontSize: 10,
                      }}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function toneForPct(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-neutral-100";
}

function ReturnsMetricCard({
  strategyReturnPct,
  klciReturnPct,
  sp500ReturnPct,
}: {
  strategyReturnPct: number;
  klciReturnPct: number;
  sp500ReturnPct: number;
}) {
  return (
    <article className="min-w-0 rounded border border-neutral-800 bg-[#111111] p-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">Returns</p>
      <dl className="mt-1 space-y-0.5 font-mono text-[10px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500">Strategy</dt>
          <dd className={`font-semibold tabular-nums ${toneForPct(strategyReturnPct)}`}>
            {formatSignedPct(strategyReturnPct)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500">FBM KLCI</dt>
          <dd className={`tabular-nums text-neutral-400 ${toneForPct(klciReturnPct)}`}>
            {formatSignedPct(klciReturnPct)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500">S&P 500</dt>
          <dd className={`tabular-nums text-neutral-400 ${toneForPct(sp500ReturnPct)}`}>
            {formatSignedPct(sp500ReturnPct)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function MetricCard({
  title,
  primary,
  secondary,
  primaryTone = "text-neutral-100",
}: {
  title: string;
  primary: string;
  secondary: string;
  primaryTone?: string;
}) {
  return (
    <article className="min-w-0 rounded border border-neutral-800 bg-[#111111] p-2">
      <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
        {title}
      </p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${primaryTone}`}>
        {primary}
      </p>
      <p className="truncate font-mono text-[9px] text-neutral-600">{secondary}</p>
    </article>
  );
}

function EquityTooltip({
  active,
  payload,
  signalByDate,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BacktestEquityPoint }>;
  signalByDate: Map<string, BacktestSignal>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const signal = signalByDate.get(row.date);

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/90 px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">{row.date}</p>
      <p className="text-amber-400">Strategy equity · RM {row.strategy.toFixed(0)}</p>
      <p className="text-neutral-400">FBM KLCI · RM {row.benchmark.toFixed(0)}</p>
      <p className="text-purple-400">S&P 500 · RM {row.sp500Equity.toFixed(0)}</p>
      <p className="text-neutral-500">Cash · RM {row.cash.toFixed(0)}</p>
      {signal ? (
        <p className={signal.type === "buy" ? "text-gain" : "text-loss"}>
          {signal.type === "buy" ? "▲ BUY" : "▼ SELL"} @ RM {signal.price.toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}
