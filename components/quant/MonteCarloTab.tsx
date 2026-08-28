"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TargetSymbolCombobox } from "@/components/quant-hub/TargetSymbolCombobox";
import { formatPct, formatPrice } from "@/lib/format";
import {
  MONTE_CARLO_HORIZON_OPTIONS,
  MONTE_CARLO_RUN_OPTIONS,
  annualizeMu,
  annualizeSigma,
  estimateGbmParameters,
  runMonteCarloSimulation,
  type MonteCarloChartRow,
  type MonteCarloHorizon,
  type MonteCarloRunCount,
  type MonteCarloSimulationResult,
} from "@/lib/quant/monte-carlo";
import { formatStockPriceLabel } from "@/lib/stock-names";
import type { HistoryPayload } from "@/lib/types";

const PANEL = "rounded border border-neutral-800 bg-[#0d0d0d] p-3";
const TAB_PILL_ACTIVE = "border-amber-500/50 bg-amber-500/15 text-amber-400";
const TAB_PILL_IDLE =
  "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300";

const MONTE_CARLO_RUNS = MONTE_CARLO_RUN_OPTIONS;

function historyFromDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchHistory(symbol: string): Promise<number[]> {
  const from = historyFromDate(504);
  const response = await fetch(
    `/api/history?symbols=${encodeURIComponent(symbol)}&from=${from}`,
  );
  const body = (await response.json()) as HistoryPayload | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
  }
  const points = "series" in body ? (body.series[symbol] ?? []) : [];
  return points.map((point) => point.close).filter(Number.isFinite);
}

function formatHorizonTick(day: number, horizonDays: number): string {
  if (day === 0) return "Now";
  const stride = Math.max(1, Math.floor(horizonDays / 8));
  if (day % stride === 0 || day === horizonDays) return `+${day}d`;
  return "";
}

function formatVar95Pct(var95Pct: number): string {
  const sign = var95Pct > 0 ? "+" : "";
  return `${sign}${var95Pct.toFixed(2)}%`;
}

type MonteCarloTabProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function MonteCarloTab({ symbol, onSymbolChange }: MonteCarloTabProps) {
  const [horizon, setHorizon] = useState<MonteCarloHorizon>(30);
  const [runs, setRuns] = useState<MonteCarloRunCount>(250);
  const [closes, setCloses] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchHistory(symbol)
      .then((next) => {
        if (cancelled) return;
        setCloses(next);
        if (next.length < 11) {
          setError("Insufficient price history for drift/volatility estimate");
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        setCloses([]);
        setError(cause instanceof Error ? cause.message : "History request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const autoParams = useMemo(() => estimateGbmParameters(closes), [closes]);
  const startPrice = closes.at(-1) ?? null;
  const muDaily = autoParams?.muDaily ?? 0;
  const sigmaDaily = autoParams?.sigmaDaily ?? 0.02;

  const simulation = useMemo<MonteCarloSimulationResult | null>(() => {
    if (startPrice == null || startPrice <= 0 || !autoParams) return null;
    return runMonteCarloSimulation({
      startPrice,
      muDaily,
      sigmaDaily,
      horizonDays: horizon,
      runs,
    });
  }, [autoParams, horizon, muDaily, runs, sigmaDaily, startPrice]);

  const sampleKeys = simulation?.samplePathIndices.map((index) => `sample_${index}`) ?? [];
  const priceLabel = formatStockPriceLabel(symbol);

  return (
    <section className={`flex flex-col gap-3 ${PANEL}`}>
      <div className="flex flex-wrap items-end gap-2 border-b border-neutral-800 pb-2">
        <div className="min-w-[180px] flex-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Target
          </span>
          <TargetSymbolCombobox value={symbol} onChange={onSymbolChange} />
        </div>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          {MONTE_CARLO_HORIZON_OPTIONS.filter((option) =>
            [30, 60, 90, 180, 365].includes(option.days),
          ).map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setHorizon(option.days as MonteCarloHorizon)}
              className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                horizon === option.days ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Runs
          </span>
          <select
            value={runs}
            onChange={(event) => setRuns(Number(event.target.value) as MonteCarloRunCount)}
            className="rounded border border-neutral-800 bg-[#111111] px-2 py-1 font-mono text-xs text-neutral-200 outline-none focus:border-amber-400/40"
          >
            {MONTE_CARLO_RUNS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {autoParams ? (
          <span className="inline-flex items-center gap-2 rounded border border-neutral-800 bg-[#111111] px-2 py-1 font-mono text-[10px] text-neutral-300">
            <span>μ: {(annualizeMu(muDaily) * 100).toFixed(2)}%</span>
            <span className="text-neutral-600">·</span>
            <span>σ: {(annualizeSigma(sigmaDaily) * 100).toFixed(2)}%</span>
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded border border-neutral-800 bg-[#111111]" />
          ))}
        </div>
      ) : null}

      {simulation && startPrice != null ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <MicroCard
              label="S₀ → Expected"
              value={`${formatPrice(startPrice)} → ${formatPrice(simulation.stats.meanPrice)}`}
              sub={`${formatPct(simulation.stats.meanReturnPct)} · ${simulation.horizonLabel}`}
            />
            <MicroCard
              label="Profit Probability"
              value={`${simulation.stats.profitProbability.toFixed(1)}%`}
              sub={`Above ${formatPrice(startPrice)}`}
              tone="text-gain"
            />
            <MicroCard
              label="95% VaR"
              value={formatVar95Pct(simulation.stats.var95Pct)}
              sub="5th percentile vs S₀"
              tone={simulation.stats.var95Pct < 0 ? "text-rose-400" : "text-gain"}
            />
          </div>

          <div className="h-[380px] rounded border border-neutral-800 bg-[#111111] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={simulation.chartRows} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(day) => formatHorizonTick(Number(day), simulation.horizonDays)}
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(value) => `RM ${Number(value).toFixed(2)}`}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  width={58}
                  domain={simulation.chartYDomain}
                />
                <Tooltip
                  content={
                    <MonteCarloTooltip
                      startPrice={startPrice}
                      priceLabel={priceLabel}
                      horizonLabel={simulation.horizonLabel}
                    />
                  }
                />
                {sampleKeys.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke="#34d399"
                    strokeWidth={1}
                    dot={false}
                    isAnimationActive={false}
                    legendType="none"
                    strokeOpacity={0.16}
                  />
                ))}
                <Line type="monotone" dataKey="p10" stroke="#f87171" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="p50" stroke="#fbbf24" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="p90" stroke="#4ade80" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : !loading && !error ? (
        <p className="font-mono text-[10px] text-neutral-500">Select a valid ticker to run GBM paths.</p>
      ) : null}
    </section>
  );
}

function MicroCard({
  label,
  value,
  sub,
  tone = "text-neutral-100",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <article className="min-w-0 rounded border border-neutral-800 bg-[#111111] p-2">
      <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="truncate font-mono text-[9px] text-neutral-600">{sub}</p>
    </article>
  );
}

function MonteCarloTooltip({
  active,
  payload,
  startPrice,
  priceLabel,
  horizonLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MonteCarloChartRow }>;
  startPrice: number;
  priceLabel: string;
  horizonLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded border border-neutral-700 bg-[#121212] px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">
        Day +{row.day} · {horizonLabel}
      </p>
      <p className="text-gain">Bull 90th · {formatPrice(row.p90)}</p>
      <p className="text-amber-400">Median · {formatPrice(row.p50)}</p>
      <p className="text-loss">Bear 10th · {formatPrice(row.p10)}</p>
      <p className="mt-1 text-neutral-600">
        {priceLabel} · S₀ {formatPrice(startPrice)}
      </p>
    </div>
  );
}
