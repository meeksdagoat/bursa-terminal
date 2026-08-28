"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { TargetSymbolCombobox } from "@/components/quant-hub/TargetSymbolCombobox";
import {
  DEFAULT_FRONTIER_SYMBOLS,
  FRONTIER_PORTFOLIO_PRESETS,
  MAX_FRONTIER_SYMBOLS,
  MIN_FRONTIER_SYMBOLS,
  alignReturnMatrix,
  formatWeightPct,
  portfolioForRiskTolerance,
  simulateEfficientFrontier,
  type FrontierResult,
} from "@/lib/quant/portfolio";
import { formatStockListInline } from "@/lib/stock-names";
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

export function PortfolioFrontierTab() {
  const [symbols, setSymbols] = useState<string[]>([...DEFAULT_FRONTIER_SYMBOLS]);
  const [addDraft, setAddDraft] = useState("1155.KL");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [frontier, setFrontier] = useState<FrontierResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addSymbol = useCallback((symbol: string) => {
    setActivePreset(null);
    setSymbols((current) => {
      if (current.includes(symbol) || current.length >= MAX_FRONTIER_SYMBOLS) return current;
      return [...current, symbol];
    });
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    setActivePreset(null);
    setSymbols((current) => {
      if (current.length <= MIN_FRONTIER_SYMBOLS) return current;
      return current.filter((item) => item !== symbol);
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = FRONTIER_PORTFOLIO_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);
    setSymbols([...preset.symbols].slice(0, MAX_FRONTIER_SYMBOLS));
  }, []);

  useEffect(() => {
    if (symbols.length < MIN_FRONTIER_SYMBOLS) {
      setFrontier(null);
      setLoading(false);
      setError(`Select at least ${MIN_FRONTIER_SYMBOLS} symbols`);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchHistory(symbols, historyFromDate(365 * 2))
      .then((body) => {
        if (cancelled) return;
        const seriesBySymbol = Object.fromEntries(
          symbols.map((symbol) => [symbol, body.series[symbol] ?? []]),
        );
        const matrix = alignReturnMatrix(seriesBySymbol);
        if (!matrix) {
          setFrontier(null);
          setError("Need at least 60 aligned trading days across selected names");
          return;
        }
        setFrontier(simulateEfficientFrontier(matrix));
      })
      .catch((cause) => {
        if (cancelled) return;
        setFrontier(null);
        setError(cause instanceof Error ? cause.message : "Frontier simulation failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbols]);

  const selectedPortfolio = useMemo(() => {
    if (!frontier) return null;
    return portfolioForRiskTolerance(frontier, riskTolerance);
  }, [frontier, riskTolerance]);

  const riskTolerancePoint = useMemo(() => {
    if (!selectedPortfolio) return null;
    return {
      risk: selectedPortfolio.risk * 100,
      expectedReturn: selectedPortfolio.expectedReturn * 100,
      sharpe: selectedPortfolio.sharpe,
    };
  }, [selectedPortfolio]);

  const scatterData = useMemo(
    () =>
      (frontier?.points ?? []).map((point) => ({
        risk: point.risk * 100,
        expectedReturn: point.expectedReturn * 100,
        sharpe: point.sharpe,
      })),
    [frontier?.points],
  );

  return (
    <section className={`flex flex-col gap-3 ${PANEL}`}>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
          Preset Portfolios
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FRONTIER_PORTFOLIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                activePreset === preset.id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Portfolio Universe ({MIN_FRONTIER_SYMBOLS}–{MAX_FRONTIER_SYMBOLS} names)
          </p>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-md">
            {symbols.length < MAX_FRONTIER_SYMBOLS ? (
              <div className="min-w-[180px] flex-1">
                <TargetSymbolCombobox
                  compact
                  placeholder="Add symbol…"
                  value={addDraft}
                  onChange={(symbol) => {
                    setAddDraft(symbol);
                    addSymbol(symbol);
                  }}
                />
              </div>
            ) : null}
            <span className="shrink-0 font-mono text-[9px] text-neutral-600">
              {symbols.length} / {MAX_FRONTIER_SYMBOLS} selected
            </span>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {symbols.map((symbol) => (
            <span
              key={symbol}
              className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-800 bg-[#111111] py-0.5 pl-2 pr-1 font-mono text-[10px] text-neutral-300"
            >
              <span className="truncate">{formatStockListInline([symbol], 1)}</span>
              <button
                type="button"
                onClick={() => removeSymbol(symbol)}
                disabled={symbols.length <= MIN_FRONTIER_SYMBOLS}
                aria-label={`Remove ${symbol}`}
                className="shrink-0 rounded px-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {symbols.length >= MAX_FRONTIER_SYMBOLS ? (
          <p className="mt-1.5 font-mono text-[9px] text-amber-400">
            Maximum {MAX_FRONTIER_SYMBOLS} symbols reached — remove one to add another.
          </p>
        ) : null}
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
          Risk Tolerance
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(riskTolerance * 100)}
          onChange={(event) => setRiskTolerance(Number(event.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer accent-amber-400"
        />
        <span className="font-mono text-[10px] text-neutral-500">
          Conservative ← {Math.round(riskTolerance * 100)}% risk appetite → Aggressive
        </span>
      </label>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="h-[360px] animate-pulse rounded border border-neutral-800 bg-[#111111]" />
      ) : frontier ? (
        <>
          <p className="font-mono text-[9px] text-neutral-600">
            {frontier.points.length.toLocaleString()} random weight portfolios ·{" "}
            {frontier.symbols.length}×{frontier.symbols.length} covariance matrix
          </p>

          <div className="h-[360px] rounded border border-neutral-800 bg-[#111111] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: 8, bottom: 16 }}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="risk"
                  name="Risk"
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  label={{
                    value: "Risk (Ann. Std Dev %)",
                    position: "insideBottom",
                    offset: -4,
                    fill: "#525252",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="expectedReturn"
                  name="Return"
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  width={48}
                  label={{
                    value: "Expected Return %",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#525252",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                />
                <ZAxis range={[20, 20]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as {
                      risk: number;
                      expectedReturn: number;
                      sharpe: number;
                    };
                    return (
                      <div className="rounded border border-neutral-800 bg-neutral-950/90 px-2 py-1.5 font-mono text-[10px]">
                        <p className="text-neutral-400">Risk {row.risk.toFixed(2)}%</p>
                        <p className="text-gain">Return {row.expectedReturn.toFixed(2)}%</p>
                        <p className="text-amber-400">Sharpe {row.sharpe.toFixed(2)}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} fill="#525252" fillOpacity={0.35} />
                <Scatter
                  data={[
                    {
                      risk: frontier.minVariance.risk * 100,
                      expectedReturn: frontier.minVariance.expectedReturn * 100,
                      sharpe: frontier.minVariance.sharpe,
                    },
                  ]}
                  fill="#22d3ee"
                  shape={MinVarianceDot}
                />
                <Scatter
                  data={[
                    {
                      risk: frontier.maxSharpe.risk * 100,
                      expectedReturn: frontier.maxSharpe.expectedReturn * 100,
                      sharpe: frontier.maxSharpe.sharpe,
                    },
                  ]}
                  fill="#4ade80"
                  shape={MaxSharpeDot}
                />
                {riskTolerancePoint ? (
                  <Scatter
                    name="Risk Tolerance"
                    data={[riskTolerancePoint]}
                    shape={RiskToleranceDot}
                    isAnimationActive
                    animationDuration={160}
                    animationEasing="ease-out"
                  />
                ) : null}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <AllocationCard
              title="Max Sharpe Portfolio"
              titleClass="text-gain"
              symbols={frontier.symbols}
              weights={frontier.maxSharpe.weights}
              meanReturns={frontier.meanReturns}
            />
            <AllocationCard
              title="Min Variance Portfolio"
              titleClass="text-cyan-400"
              symbols={frontier.symbols}
              weights={frontier.minVariance.weights}
              meanReturns={frontier.meanReturns}
            />
          </div>

          {selectedPortfolio && riskTolerancePoint ? (
            <p className="font-mono text-[9px] text-amber-400/90">
              Risk tolerance marker · Return {riskTolerancePoint.expectedReturn.toFixed(2)}% · Risk{" "}
              {riskTolerancePoint.risk.toFixed(2)}% · Sharpe {riskTolerancePoint.sharpe.toFixed(2)}
            </p>
          ) : null}

          {selectedPortfolio ? (
            <AllocationCard
              title={`Optimal Allocation · Risk Tolerance ${Math.round(riskTolerance * 100)}%`}
              titleClass="text-amber-400"
              panelClass="border-amber-400/20 bg-amber-400/5"
              symbols={frontier.symbols}
              weights={selectedPortfolio.weights}
              meanReturns={frontier.meanReturns}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

type FrontierMarkerDotProps = {
  cx?: number;
  cy?: number;
};

function MinVarianceDot({ cx, cy }: FrontierMarkerDotProps) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#22d3ee" stroke="#ffffff" strokeWidth={1.5} />;
}

function MaxSharpeDot({ cx, cy }: FrontierMarkerDotProps) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#4ade80" stroke="#ffffff" strokeWidth={1.5} />;
}

function RiskToleranceDot({ cx, cy }: FrontierMarkerDotProps) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="#f59e0b" fillOpacity={0.22}>
        <animate attributeName="r" values="8;12;8" dur="2.2s" repeatCount="indefinite" />
        <animate
          attributeName="fill-opacity"
          values="0.35;0.12;0.35"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
    </g>
  );
}

function AllocationCard({
  title,
  titleClass,
  panelClass = "border-neutral-800 bg-[#111111]",
  symbols,
  weights,
  meanReturns,
}: {
  title: string;
  titleClass: string;
  panelClass?: string;
  symbols: string[];
  weights: number[];
  meanReturns: number[];
}) {
  const rows = symbols
    .map((symbol, index) => ({
      symbol,
      weight: weights[index] ?? 0,
      mu: (meanReturns[index] ?? 0) * 100,
    }))
    .sort((left, right) => right.weight - left.weight);

  return (
    <article className={`rounded border p-2 ${panelClass}`}>
      <p className={`font-mono text-[9px] uppercase tracking-[0.12em] ${titleClass}`}>{title}</p>
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <li
            key={row.symbol}
            className="flex items-center justify-between gap-2 font-mono text-[10px] text-neutral-300"
          >
            <span className="min-w-0 truncate">{formatStockListInline([row.symbol], 1)}</span>
            <span className="shrink-0 tabular-nums">
              <span className="text-amber-400">{formatWeightPct(row.weight)}</span>
              <span className="ml-1.5 text-[9px] text-neutral-600">μ {row.mu.toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
