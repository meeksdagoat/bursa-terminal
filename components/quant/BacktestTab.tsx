"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BacktestTradeSummary } from "@/components/quant/BacktestTradeSummary";
import { QuantAssetSelector } from "@/components/quant/QuantAssetSelector";
import { CustomStrategyModal } from "@/components/quant/CustomStrategyModal";
import { StrategyBuilderModal } from "@/components/quant/StrategyBuilderModal";
import {
  BACKTEST_STRATEGIES,
  prepareBacktestBarData,
  prepareBacktestData,
  type BacktestEquityPoint,
  type BacktestResult,
  type BacktestStrategyId,
} from "@/lib/quant/backtest";
import {
  downsampleEquityCurveForChart,
} from "@/lib/quant/backtest-chart";
import { runStrategyBacktest } from "@/lib/quant/backtest-engine";
import {
  coerceLookbackForTimeframe,
  coerceTimeframeForAsset,
  formatBacktestAxisLabel,
  formatBacktestTooltipLabel,
  getBacktestProviderStatusBadge,
  getLookbackOptionsForTimeframe,
  getTimeframeOptionsForAsset,
  resolveBacktestFetchRange,
  type BacktestLookbackOptionId,
  type BacktestTimeframe,
} from "@/lib/quant/backtest-timeframe";
import {
  cloneCustomStrategy,
  customStrategyIdFromKey,
  customStrategyKey,
  isCustomStrategyKey,
  isSpotAccumulationStrategy,
  resolveCustomStrategyById,
  resolveCustomStrategyTimeframe,
  type CustomStrategy,
} from "@/lib/quant/custom-strategy";
import {
  DEFAULT_QUANT_ASSET_SYMBOL,
  capitalFieldLabel,
  formatAssetCapitalTick,
  formatAssetPrice,
  resolveQuantAsset,
  type QuantAssetCurrency,
} from "@/lib/quant/asset-catalog";
import { useCustomStrategiesContext } from "@/components/quant/CustomStrategiesProvider";
import type {
  AssetBuyAndHoldPoint,
  BacktestHistoryPayload,
  HistoryPayload,
} from "@/lib/types";

const PANEL = "rounded border border-neutral-800 bg-[#0d0d0d] p-3";
const TOOLBAR_SELECT =
  "rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500";

function historyFromDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchDailyBenchmarkHistory(symbols: string[], from: string): Promise<HistoryPayload> {
  const response = await fetch(
    `/api/history?symbols=${encodeURIComponent(symbols.join(","))}&from=${from}`,
  );
  const body = (await response.json()) as HistoryPayload | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
  }
  return body as HistoryPayload;
}

async function fetchBacktestHistoryClient(input: {
  symbol: string;
  timeframe: BacktestTimeframe;
  from: string;
  to: string;
  lookbackOption: BacktestLookbackOptionId;
  initialCapital: number;
}): Promise<BacktestHistoryPayload> {
  const params = new URLSearchParams({
    symbol: input.symbol,
    timeframe: input.timeframe,
    from: input.from,
    to: input.to,
    lookback: input.lookbackOption,
    initialCapital: String(input.initialCapital),
  });
  const response = await fetch(`/api/quant/backtest-history?${params.toString()}`);
  const body = (await response.json()) as BacktestHistoryPayload | { error?: string };
  if (!response.ok && !("bars" in body)) {
    throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
  }
  return body as BacktestHistoryPayload;
}

function collectHistoryNotices(
  barPayload: BacktestHistoryPayload,
  extras: {
    usedMockData: boolean;
    benchmarkErrors: string[];
  },
): string | null {
  const notices: string[] = [];

  if (barPayload.warning) {
    notices.push(barPayload.warning);
  } else if (barPayload.truncated) {
    notices.push("Selected timeframe history truncated by provider API.");
  }

  if (extras.usedMockData) {
    notices.push(
      "Live history incomplete — running on seeded GBM synthetic series so the engine always renders.",
    );
  } else if (extras.benchmarkErrors.length > 0) {
    notices.push(`Partial benchmark feed: ${extras.benchmarkErrors.slice(0, 1).join("")}`);
  }

  return notices.length > 0 ? notices.join(" ") : null;
}

function mergeBacktestNotices(parts: Array<string | null | undefined>): string | null {
  const notices = parts.filter((part): part is string => Boolean(part && part.trim().length > 0));
  return notices.length > 0 ? notices.join(" ") : null;
}

function mergeAssetBuyAndHoldIntoEquityCurve(
  equityCurve: BacktestEquityPoint[],
  apiCurve: AssetBuyAndHoldPoint[],
  initialCapital: number,
): BacktestEquityPoint[] {
  if (!apiCurve.length || !equityCurve.length) return equityCurve;

  const byTimestamp = new Map(apiCurve.map((point) => [point.timestamp, point.value]));
  const firstDate = equityCurve[0]?.date;
  const baseValue = firstDate ? byTimestamp.get(firstDate) : undefined;

  if (!baseValue || baseValue <= 0) return equityCurve;

  return equityCurve.map((point) => {
    const rawValue = byTimestamp.get(point.date);
    if (rawValue == null || rawValue <= 0) return point;
    return {
      ...point,
      buyHold: initialCapital * (rawValue / baseValue),
    };
  });
}

function buyHoldReturnFromCurve(
  curve: BacktestEquityPoint[],
  fallback: number,
): number {
  if (curve.length === 0) return fallback;
  const start = curve[0]?.buyHold ?? 0;
  const end = curve.at(-1)?.buyHold ?? start;
  if (start <= 0) return fallback;
  return ((end - start) / start) * 100;
}

const CREATE_STRATEGY_OPTION = "__create__";

type BacktestTabProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function BacktestTab({ symbol, onSymbolChange }: BacktestTabProps) {
  const asset = resolveQuantAsset(symbol) ?? resolveQuantAsset(DEFAULT_QUANT_ASSET_SYMBOL)!;
  const { strategies: customStrategies, upsertStrategy, removeStrategy, getStrategyById } =
    useCustomStrategiesContext();
  const [strategyKey, setStrategyKey] = useState<string>("rsi_mean_reversion_14");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<{
    id: string;
    snapshot: CustomStrategy;
  } | null>(null);
  const [lookbackOption, setLookbackOption] = useState<BacktestLookbackOptionId>("3y");
  const [selectedTimeframe, setSelectedTimeframe] = useState<BacktestTimeframe>("1D");
  const [initialCapital, setInitialCapital] = useState(10_000);
  const [stopLossPct, setStopLossPct] = useState(8);
  const [takeProfitPct, setTakeProfitPct] = useState(15);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [computingBacktest, setComputingBacktest] = useState(false);
  const [mockNotice, setMockNotice] = useState<string | null>(null);
  const [performanceNotice, setPerformanceNotice] = useState<string | null>(null);
  const [assetBuyAndHold, setAssetBuyAndHold] = useState<AssetBuyAndHoldPoint[]>([]);
  const [assetHoldReturn, setAssetHoldReturn] = useState<number | null>(null);

  useEffect(() => {
    setLookbackOption((current) => coerceLookbackForTimeframe(selectedTimeframe, current));
  }, [selectedTimeframe]);

  useEffect(() => {
    setSelectedTimeframe((current) =>
      coerceTimeframeForAsset(current, { symbol, category: asset.category }),
    );
  }, [symbol, asset.category]);

  const activeCustomStrategyId = customStrategyIdFromKey(strategyKey);

  const activeCustomStrategy = useMemo(
    () => resolveCustomStrategyById(customStrategies, activeCustomStrategyId),
    [customStrategies, activeCustomStrategyId],
  );

  const openEditModal = () => {
    if (!activeCustomStrategy) return;
    const snapshot = cloneCustomStrategy(activeCustomStrategy);
    setEditSession({
      id: snapshot.id,
      snapshot,
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditSession(null);
  };

  const spotMode =
    isSpotAccumulationStrategy(activeCustomStrategy) ||
    result?.metrics.executionMode === "SPOT_ACCUMULATION";

  const applyCustomStrategySettings = (strategy: CustomStrategy | null) => {
    if (!strategy) return;
    if (strategy.stopLossPct != null) setStopLossPct(strategy.stopLossPct);
    if (strategy.takeProfitPct != null) setTakeProfitPct(strategy.takeProfitPct);
    setSelectedTimeframe(
      coerceTimeframeForAsset(resolveCustomStrategyTimeframe(strategy), {
        symbol,
        category: asset.category,
      }),
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setComputingBacktest(false);
    setMockNotice(null);
    setAssetBuyAndHold([]);
    setAssetHoldReturn(null);

    const fetchConfig = resolveBacktestFetchRange({
      lookbackOption,
      timeframe: selectedTimeframe,
    });
    const benchFrom = fetchConfig.from;
    const benchSymbols = [...new Set([asset.benchmarkSymbol, asset.referenceSymbol])];

    void Promise.all([
      fetchBacktestHistoryClient({
        symbol,
        timeframe: selectedTimeframe,
        from: fetchConfig.from,
        to: fetchConfig.to,
        lookbackOption,
        initialCapital,
      }),
      fetchDailyBenchmarkHistory(benchSymbols, benchFrom),
    ])
      .then(async ([barPayload, benchBody]) => {
        if (cancelled) return;

        setAssetBuyAndHold(barPayload.assetBuyAndHold ?? []);
        setAssetHoldReturn(barPayload.assetHoldReturn ?? null);

        const benchmarkPoints = benchBody.series[asset.benchmarkSymbol] ?? [];
        const referencePoints = benchBody.series[asset.referenceSymbol] ?? [];
        const { aligned, usedMockData } = prepareBacktestBarData({
          symbol,
          bars: barPayload.bars,
          benchmarkPoints,
          sp500Points: referencePoints,
          lookback: fetchConfig.engineLookback,
          timeframe: selectedTimeframe,
          evaluationCalendarDays: fetchConfig.calendarDays,
        });

        if (!aligned) {
          setResult(null);
          setMockNotice(
            mergeBacktestNotices([
              fetchConfig.performanceWarning,
              barPayload.bars.length === 0
                ? collectHistoryNotices(barPayload, {
                    usedMockData: false,
                    benchmarkErrors: benchBody.errors,
                  }) ??
                    barPayload.warning ??
                    `No ${selectedTimeframe} history returned for ${symbol}. Try a higher timeframe or wider lookback.`
                : "Insufficient aligned bars for backtest — widen lookback or change asset.",
            ]),
          );
          return;
        }

        setLoading(false);
        setComputingBacktest(true);

        const backtest = await runStrategyBacktest({
          aligned,
          lookback: fetchConfig.engineLookback,
          strategy: isCustomStrategyKey(strategyKey)
            ? "rsi_mean_reversion_14"
            : (strategyKey as BacktestStrategyId),
          customStrategy: activeCustomStrategy,
          initialCapital,
          stopLossPct,
          takeProfitPct,
          usedMockData,
        });

        if (cancelled) return;

        setResult(backtest);
        setComputingBacktest(false);

        setMockNotice(
          mergeBacktestNotices([
            fetchConfig.performanceWarning,
            collectHistoryNotices(barPayload, {
              usedMockData,
              benchmarkErrors: benchBody.errors,
            }),
          ]),
        );
      })
      .catch(async () => {
        if (cancelled) return;

        const { aligned, usedMockData } = prepareBacktestData({
          symbol,
          stockPoints: [],
          benchmarkPoints: [],
          sp500Points: [],
          lookback: fetchConfig.engineLookback,
        });

        if (!aligned) {
          setResult(null);
          setMockNotice("History request failed — unable to load live price series.");
          return;
        }

        setLoading(false);
        setComputingBacktest(true);

        const backtest = await runStrategyBacktest({
          aligned,
          lookback: fetchConfig.engineLookback,
          strategy: isCustomStrategyKey(strategyKey)
            ? "rsi_mean_reversion_14"
            : (strategyKey as BacktestStrategyId),
          customStrategy: activeCustomStrategy,
          initialCapital,
          stopLossPct,
          takeProfitPct,
          usedMockData: true,
        });

        if (cancelled) return;

        setResult(backtest);
        setComputingBacktest(false);
        setMockNotice("History request failed — displaying seeded synthetic backtest data.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setComputingBacktest(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    symbol,
    asset.benchmarkSymbol,
    asset.referenceSymbol,
    strategyKey,
    activeCustomStrategyId,
    activeCustomStrategy?.updatedAt,
    lookbackOption,
    selectedTimeframe,
    initialCapital,
    stopLossPct,
    takeProfitPct,
  ]);

  const chartData = useMemo(() => {
    if (!result) return [];
    const merged = mergeAssetBuyAndHoldIntoEquityCurve(
      result.equityCurve,
      assetBuyAndHold,
      initialCapital,
    );
    return downsampleEquityCurveForChart(merged);
  }, [result, assetBuyAndHold, initialCapital]);

  const displayBuyHoldReturnPct = useMemo(() => {
    if (!result) return 0;
    const merged = mergeAssetBuyAndHoldIntoEquityCurve(
      result.equityCurve,
      assetBuyAndHold,
      initialCapital,
    );
    if (merged.length > 0) {
      return buyHoldReturnFromCurve(merged, result.metrics.buyHoldReturnPct);
    }
    return assetHoldReturn ?? result.metrics.buyHoldReturnPct;
  }, [result, assetBuyAndHold, initialCapital, assetHoldReturn]);

  const buyHoldLegendLabel = `Buy & Hold (${asset.label})`;

  const providerBadge = useMemo(
    () => getBacktestProviderStatusBadge(selectedTimeframe),
    [selectedTimeframe],
  );

  const lookbackOptions = useMemo(
    () => getLookbackOptionsForTimeframe(selectedTimeframe),
    [selectedTimeframe],
  );

  const timeframeOptions = useMemo(
    () => getTimeframeOptionsForAsset({ symbol, category: asset.category }),
    [symbol, asset.category],
  );

  const bannerNotice = useMemo(
    () => mergeBacktestNotices([mockNotice, performanceNotice]),
    [mockNotice, performanceNotice],
  );

  return (
    <section className={`flex flex-col gap-3 ${PANEL}`}>
      <div className="border-b border-neutral-800 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Strategy Backtest
        </p>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <QuantAssetSelector value={symbol} onChange={onSymbolChange} className="min-w-0 flex-1" />

        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Strategy
          </span>
          <div className="flex gap-1.5">
            <select
              value={strategyKey}
              onChange={(event) => {
                const value = event.target.value;
                if (value === CREATE_STRATEGY_OPTION) {
                  setBuilderOpen(true);
                  return;
                }
                setStrategyKey(value);
                const customId = customStrategyIdFromKey(value);
                if (customId) {
                  const selected = getStrategyById(customId) ?? null;
                  applyCustomStrategySettings(selected);
                }
              }}
              className="min-w-0 flex-1 rounded border border-neutral-800 bg-[#0d0d0d] px-2 py-2 font-mono text-[11px] text-neutral-200 outline-none focus:border-amber-400/40"
            >
              {BACKTEST_STRATEGIES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              {customStrategies.length > 0 ? (
                <optgroup label="Custom Strategies">
                  {customStrategies.map((option) => (
                    <option key={option.id} value={customStrategyKey(option.id)}>
                      {option.category ? `[${option.category}] ` : ""}
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value={CREATE_STRATEGY_OPTION}>+ Create Custom Strategy</option>
            </select>
            <button
              type="button"
              onClick={openEditModal}
              disabled={!activeCustomStrategy}
              title={
                activeCustomStrategy
                  ? `Edit ${activeCustomStrategy.name}`
                  : "Select a custom strategy to edit"
              }
              className="shrink-0 rounded border border-neutral-800 bg-[#0d0d0d] px-2.5 py-2 font-mono text-[10px] text-neutral-300 transition-colors hover:border-amber-400/40 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-800 disabled:hover:text-neutral-300"
            >
              ✏️ Edit
            </button>
          </div>
          <p className="mt-1 min-h-[15px] font-mono text-[10px] text-neutral-600">
            {activeCustomStrategy
              ? [
                  activeCustomStrategy.category ? `[${activeCustomStrategy.category}]` : null,
                  activeCustomStrategy.description,
                  isSpotAccumulationStrategy(activeCustomStrategy)
                    ? `Spot accumulation · ${activeCustomStrategy.buyConditions.length} buy rules (AND) · ${activeCustomStrategy.spotBuyPctOfCash ?? 25}% cash tranche · TF ${resolveCustomStrategyTimeframe(activeCustomStrategy)}`
                    : `${activeCustomStrategy.buyConditions.length} buy · ${activeCustomStrategy.sellConditions.length} sell rules (AND) · TF ${resolveCustomStrategyTimeframe(activeCustomStrategy)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Rule-based entry / exit signals"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-zinc-400">PERIOD</span>
            <select
              value={lookbackOption}
              onChange={(event) =>
                setLookbackOption(event.target.value as BacktestLookbackOptionId)
              }
              aria-label="Lookback period"
              className={TOOLBAR_SELECT}
            >
              {lookbackOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-zinc-400">TIMEFRAME</span>
            <select
              value={selectedTimeframe}
              onChange={(event) => {
                const nextTimeframe = event.target.value as BacktestTimeframe;
                setSelectedTimeframe(nextTimeframe);
                setLookbackOption((current) => coerceLookbackForTimeframe(nextTimeframe, current));
              }}
              aria-label="Chart timeframe"
              className={TOOLBAR_SELECT}
            >
              {timeframeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            {capitalFieldLabel(asset.currency)}
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

      <p className="rounded border border-neutral-800 bg-[#111111] px-2 py-1 font-mono text-[10px] text-neutral-400">
        [ {providerBadge} ]
      </p>

      {bannerNotice ? (
        <p className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1 font-mono text-[10px] text-amber-400">
          {bannerNotice}
        </p>
      ) : null}

      {loading && !result ? (
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
              benchmarkReturnPct={result.metrics.benchmarkReturnPct}
              referenceReturnPct={result.metrics.sp500ReturnPct}
              buyHoldReturnPct={displayBuyHoldReturnPct}
              buyHoldLabel={`${asset.label} Buy & Hold`}
              benchmarkLabel={asset.benchmarkLabel}
              referenceLabel={asset.referenceLabel}
            />
            {spotMode ? (
              <>
                <MetricCard
                  title="Accumulation"
                  primary={`${result.metrics.buysExecutedCount ?? 0} buys executed`}
                  secondary={`ACB ${formatAssetPrice(result.metrics.averageCostBasis ?? 0, asset.currency)}`}
                  primaryTone="text-emerald-400"
                />
                <MetricCard
                  title="Unrealized P&L"
                  primary={formatSignedPct(result.metrics.unrealizedPnlPct ?? 0)}
                  secondary={
                    (result.metrics.totalUnitsHeld ?? 0) > 0
                      ? `${(result.metrics.totalUnitsHeld ?? 0).toFixed(4)} units held`
                      : "Fully in cash"
                  }
                  primaryTone={toneForPct(result.metrics.unrealizedPnlPct ?? 0)}
                />
              </>
            ) : (
              <MetricCard
                title="Trade Stats"
                primary={`Win Rate ${result.metrics.winRatePct.toFixed(1)}%`}
                secondary={`${result.metrics.totalTrades} closed trades`}
              />
            )}
            <MetricCard
              title={spotMode ? "Portfolio Risk" : "Profit Factor"}
              primary={
                spotMode
                  ? `Max DD ${result.metrics.maxDrawdownPct.toFixed(2)}%`
                  : result.metrics.profitFactor.toFixed(2)
              }
              secondary={
                spotMode
                  ? `Sharpe ${result.metrics.sharpeRatio.toFixed(2)} · ${result.metrics.totalTrades} liquidations`
                  : "Gross profit / gross loss"
              }
              primaryTone={spotMode ? "text-rose-400" : "text-amber-400"}
            />
            {!spotMode ? (
              <MetricCard
                title="Risk"
                primary={`Max DD ${result.metrics.maxDrawdownPct.toFixed(2)}%`}
                secondary={`Sharpe ${result.metrics.sharpeRatio.toFixed(2)}`}
                primaryTone="text-rose-400"
              />
            ) : null}
          </div>

          <div className="relative flex h-[380px] flex-col rounded border border-neutral-800 bg-[#111111] p-2">
            {loading || computingBacktest ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded bg-[#111111]/85 backdrop-blur-[1px]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-amber-400" />
                <p className="font-mono text-[10px] text-neutral-400">
                  {loading
                    ? `Loading ${selectedTimeframe} candles…`
                    : "Running backtest simulation…"}
                </p>
              </div>
            ) : null}
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-amber-500" aria-hidden />
                {spotMode ? "Portfolio (Cash + Spot)" : "Strategy"}
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-0.5 w-3 border-t-2 border-dashed border-emerald-500"
                  aria-hidden
                />
                {buyHoldLegendLabel.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-neutral-500" aria-hidden />
                {asset.benchmarkLabel}
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-0.5 w-3 border-t border-dashed border-purple-500"
                  aria-hidden
                />
                {asset.referenceLabel}
              </span>
            </div>
            <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    formatBacktestAxisLabel(String(value), selectedTimeframe)
                  }
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(value) => formatAssetCapitalTick(Number(value), asset.currency)}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  width={58}
                />
                <Tooltip
                  content={
                    <EquityTooltip
                      currency={asset.currency}
                      benchmarkLabel={asset.benchmarkLabel}
                      referenceLabel={asset.referenceLabel}
                      buyHoldLabel={buyHoldLegendLabel}
                      spotMode={spotMode}
                      timeframe={selectedTimeframe}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="buyHold"
                  name={buyHoldLegendLabel}
                  stroke="#10B981"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name={asset.benchmarkLabel}
                  stroke="#6b7280"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="sp500Equity"
                  name={asset.referenceLabel}
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
                  name={spotMode ? "Portfolio (Cash + Spot)" : "Strategy"}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>

          <BacktestTradeSummary
            result={result}
            currency={asset.currency}
            timeframe={selectedTimeframe}
          />
        </>
      ) : null}

      <StrategyBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={(strategy) => {
          const saved = upsertStrategy(strategy);
          setStrategyKey(customStrategyKey(saved.id));
          applyCustomStrategySettings(saved);
        }}
      />

      <CustomStrategyModal
        open={editModalOpen}
        strategyId={editSession?.id ?? null}
        strategySnapshot={editSession?.snapshot ?? null}
        onClose={closeEditModal}
        onSave={(strategy) => {
          const saved = upsertStrategy({ ...strategy, id: editSession?.id ?? strategy.id });
          setStrategyKey(customStrategyKey(saved.id));
          applyCustomStrategySettings(saved);
          closeEditModal();
        }}
        onDelete={(id) => {
          removeStrategy(id);
          setStrategyKey("rsi_mean_reversion_14");
          closeEditModal();
        }}
      />
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
  benchmarkReturnPct,
  referenceReturnPct,
  buyHoldReturnPct,
  buyHoldLabel,
  benchmarkLabel,
  referenceLabel,
}: {
  strategyReturnPct: number;
  benchmarkReturnPct: number;
  referenceReturnPct: number;
  buyHoldReturnPct: number;
  buyHoldLabel: string;
  benchmarkLabel: string;
  referenceLabel: string;
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
          <dt className="text-neutral-500">{buyHoldLabel}</dt>
          <dd className={`tabular-nums ${toneForPct(buyHoldReturnPct)}`}>
            {formatSignedPct(buyHoldReturnPct)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500">{benchmarkLabel}</dt>
          <dd className={`tabular-nums text-neutral-400 ${toneForPct(benchmarkReturnPct)}`}>
            {formatSignedPct(benchmarkReturnPct)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-500">{referenceLabel}</dt>
          <dd className={`tabular-nums text-neutral-400 ${toneForPct(referenceReturnPct)}`}>
            {formatSignedPct(referenceReturnPct)}
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
  currency,
  benchmarkLabel,
  referenceLabel,
  buyHoldLabel,
  spotMode = false,
  timeframe = "1D",
}: {
  active?: boolean;
  payload?: Array<{ payload?: BacktestEquityPoint }>;
  currency: QuantAssetCurrency;
  benchmarkLabel: string;
  referenceLabel: string;
  buyHoldLabel: string;
  spotMode?: boolean;
  timeframe?: BacktestTimeframe;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/90 px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">{formatBacktestTooltipLabel(row.date, timeframe)}</p>
      <p className="text-amber-400">
        {spotMode ? "Portfolio" : "Strategy equity"} · {formatAssetPrice(row.strategy, currency)}
      </p>
      <p className="text-emerald-400">
        {buyHoldLabel} · {formatAssetPrice(row.buyHold, currency)}
      </p>
      <p className="text-neutral-400">
        {benchmarkLabel} · {formatAssetPrice(row.benchmark, currency)}
      </p>
      <p className="text-purple-400">
        {referenceLabel} · {formatAssetPrice(row.sp500Equity, currency)}
      </p>
      <p className="text-neutral-500">Cash · {formatAssetPrice(row.cash, currency)}</p>
    </div>
  );
}
