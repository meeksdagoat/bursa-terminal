"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TargetSymbolCombobox } from "@/components/quant-hub/TargetSymbolCombobox";
import { formatPct, formatPrice } from "@/lib/format";
import {
  MONTE_CARLO_HORIZON_OPTIONS,
  MONTE_CARLO_HORIZONS,
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

type MonteCarloSimulatorProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

type HistoryState = {
  closes: number[];
  loading: boolean;
  error: string | null;
};

const HORIZON_PILL_ACTIVE =
  "border-amber-500/50 bg-amber-500/20 text-amber-400";
const HORIZON_PILL_IDLE =
  "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300";

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

const PANEL =
  "rounded border border-neutral-800 bg-[#121212] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";

function historyFromDate(): string {
  const date = new Date(Date.now() - 504 * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function pctFromDecimal(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedAnnualTrend(muDaily: number): string {
  const annualPct = annualizeMu(muDaily) * 100;
  const sign = annualPct >= 0 ? "+" : "";
  return `${sign}${annualPct.toFixed(2)}%/yr`;
}

function formatVolatilitySpread(sigmaDaily: number): string {
  return `±${(annualizeSigma(sigmaDaily) * 100).toFixed(2)}% spread`;
}

const DRIFT_TOOLTIP =
  "Drift (Mean Return / μ): The average daily percentage price movement calculated from historical returns. It controls the overall upward or downward trajectory (trend) of the simulation.";

const VOLATILITY_TOOLTIP =
  "Volatility (Variance / σ): The standard deviation of daily returns. It measures price fluctuation and dispersion—higher volatility creates wider, more spread-out price paths.";

function InfoIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ParamInfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((value) => !value);
    }
    if (event.key === "Escape") setOpen(false);
  }

  const panelClass =
    "absolute bottom-[calc(100%+4px)] left-1/2 z-50 w-[17.5rem] -translate-x-1/2 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[10px] leading-tight text-neutral-300 shadow-xl sm:w-[19rem]";

  return (
    <span ref={rootRef} className="group/info relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
        className="inline-flex h-3.5 w-3.5 items-center justify-center text-neutral-500 transition-colors hover:text-amber-400 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400/60"
      >
        <InfoIcon />
      </button>
      {open ? (
        <span role="tooltip" className={panelClass}>
          {text}
        </span>
      ) : (
        <span
          role="tooltip"
          className={`${panelClass} pointer-events-none hidden group-hover/info:block group-focus-within/info:block`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function ParamLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[9px] text-neutral-600">
      {label}
      <ParamInfoTip label={label} text={tip} />
    </span>
  );
}

export function MonteCarloSimulator({ symbol, onSymbolChange }: MonteCarloSimulatorProps) {
  const [horizon, setHorizon] = useState<MonteCarloHorizon>(30);
  const [runs, setRuns] = useState<MonteCarloRunCount>(250);
  const [manualParams, setManualParams] = useState(false);
  const [muDailyInput, setMuDailyInput] = useState("0");
  const [sigmaDailyInput, setSigmaDailyInput] = useState("0.02");
  const [history, setHistory] = useState<HistoryState>({
    closes: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setHistory((prev) => ({ ...prev, loading: true, error: null }));

    async function loadHistory() {
      try {
        const from = historyFromDate();
        const response = await fetch(
          `/api/history?symbols=${encodeURIComponent(symbol)}&from=${from}`,
        );
        const body = (await response.json()) as HistoryPayload | { error?: string };
        if (!response.ok) {
          throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
        }
        if (cancelled) return;

        const points = "series" in body ? (body.series[symbol] ?? []) : [];
        const closes = points.map((point) => point.close).filter((value) => Number.isFinite(value));
        setHistory({
          closes,
          loading: false,
          error: closes.length < 11 ? "Insufficient price history for drift/volatility estimate" : null,
        });
      } catch (cause) {
        if (cancelled) return;
        setHistory({
          closes: [],
          loading: false,
          error: cause instanceof Error ? cause.message : "History request failed",
        });
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const autoParams = useMemo(() => estimateGbmParameters(history.closes), [history.closes]);
  const startPrice = history.closes.at(-1) ?? null;

  useEffect(() => {
    if (manualParams || !autoParams) return;
    setMuDailyInput(autoParams.muDaily.toFixed(6));
    setSigmaDailyInput(autoParams.sigmaDaily.toFixed(6));
  }, [autoParams, manualParams]);

  const activeMuDaily = manualParams
    ? Number.parseFloat(muDailyInput)
    : (autoParams?.muDaily ?? 0);
  const activeSigmaDaily = manualParams
    ? Number.parseFloat(sigmaDailyInput)
    : (autoParams?.sigmaDaily ?? 0.02);

  const paramsValid =
    Number.isFinite(activeMuDaily) &&
    Number.isFinite(activeSigmaDaily) &&
    activeSigmaDaily > 0 &&
    startPrice != null &&
    startPrice > 0;

  const simulation = useMemo<MonteCarloSimulationResult | null>(() => {
    if (!paramsValid || startPrice == null) return null;
    return runMonteCarloSimulation({
      startPrice,
      muDaily: activeMuDaily,
      sigmaDaily: activeSigmaDaily,
      horizonDays: horizon,
      runs,
    });
  }, [activeMuDaily, activeSigmaDaily, horizon, paramsValid, runs, startPrice]);

  const sampleKeys = simulation?.samplePathIndices.map((index) => `sample_${index}`) ?? [];
  const priceLabel = formatStockPriceLabel(symbol);

  return (
    <section className={`flex flex-col gap-4 ${PANEL}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Monte Carlo Price Simulator
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Geometric Brownian Motion · Box-Muller stochastic paths · client-side engine
          </p>
        </div>
        {simulation ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-gain">
            {runs.toLocaleString()} paths · {simulation.horizonLabel}
          </span>
        ) : null}
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Target Stock
            </span>
            <TargetSymbolCombobox value={symbol} onChange={onSymbolChange} />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Forecast Horizon
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {MONTE_CARLO_HORIZON_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => setHorizon(option.days)}
                  title={`${option.label} · ${option.days.toLocaleString()} trading days`}
                  className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
                    horizon === option.days ? HORIZON_PILL_ACTIVE : HORIZON_PILL_IDLE
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={MONTE_CARLO_HORIZONS.length - 1}
              step={1}
              value={MONTE_CARLO_HORIZONS.indexOf(horizon)}
              onChange={(event) => {
                const next = MONTE_CARLO_HORIZONS[Number(event.target.value)];
                if (next) setHorizon(next);
              }}
              className="h-1.5 w-full cursor-pointer accent-amber-400"
              aria-label="Forecast horizon slider"
            />
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Simulation Runs
            </span>
            <select
              value={runs}
              onChange={(event) => setRuns(Number(event.target.value) as MonteCarloRunCount)}
              className="rounded border border-neutral-800 bg-[#0d0d0d] px-2 py-2 font-mono text-[11px] text-neutral-200 outline-none focus:border-gain/40"
            >
              {MONTE_CARLO_RUN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toLocaleString()} iterations
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2 overflow-visible rounded border border-neutral-800 bg-[#0d0d0d] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Drift μ & Volatility σ
            </span>
            <label className="flex items-center gap-1.5 font-mono text-[9px] text-neutral-500">
              <input
                type="checkbox"
                checked={manualParams}
                onChange={(event) => setManualParams(event.target.checked)}
                className="accent-amber-400"
              />
              Manual override
            </label>
          </div>

          <div className="grid gap-2 overflow-visible sm:grid-cols-2">
            <label className="flex flex-col gap-1 overflow-visible">
              <ParamLabel label="Daily drift μ" tip={DRIFT_TOOLTIP} />
              <input
                type="number"
                step="0.000001"
                value={muDailyInput}
                disabled={!manualParams}
                onChange={(event) => setMuDailyInput(event.target.value)}
                className="rounded border border-neutral-800 bg-[#121212] px-2 py-1.5 font-mono text-[11px] text-neutral-200 outline-none focus:border-amber-400/40 disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1 overflow-visible">
              <ParamLabel label="Daily volatility σ" tip={VOLATILITY_TOOLTIP} />
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={sigmaDailyInput}
                disabled={!manualParams}
                onChange={(event) => setSigmaDailyInput(event.target.value)}
                className="rounded border border-neutral-800 bg-[#121212] px-2 py-1.5 font-mono text-[11px] text-neutral-200 outline-none focus:border-gain/40 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-800/80 pt-2 font-mono text-[9px] leading-tight text-neutral-500">
            <p>
              <span className="text-neutral-400">μ (Mean):</span> Expected annualized return trend (
              {formatSignedAnnualTrend(activeMuDaily)})
            </p>
            <p>
              <span className="text-neutral-400">σ (Volatility/Variance):</span> Annualized price
              variance risk ({formatVolatilitySpread(activeSigmaDaily)})
            </p>
            {!manualParams && autoParams ? (
              <p className="basis-full text-neutral-600">Parameters auto-calibrated from historical closes.</p>
            ) : null}
          </div>
        </div>
      </div>

      {history.loading ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded border border-neutral-800 bg-[#0d0d0d]" />
          ))}
        </div>
      ) : null}

      {history.error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {history.error}
        </p>
      ) : null}

      {simulation && startPrice != null ? (
        <>
          <SummaryCards
            startPrice={startPrice}
            simulation={simulation}
            muDaily={activeMuDaily}
            sigmaDaily={activeSigmaDaily}
            priceLabel={priceLabel}
          />

          <MonteCarloChart
            rows={simulation.chartRows}
            sampleKeys={sampleKeys}
            startPrice={startPrice}
            priceLabel={priceLabel}
            horizonDays={simulation.horizonDays}
            horizonLabel={simulation.horizonLabel}
            yDomain={simulation.chartYDomain}
            loading={history.loading}
          />
        </>
      ) : !history.loading && !history.error ? (
        <p className="font-mono text-[10px] text-neutral-500">
          Select a valid ticker and parameters to run the simulation.
        </p>
      ) : null}
    </section>
  );
}

function SummaryCards({
  startPrice,
  simulation,
  muDaily,
  sigmaDaily,
  priceLabel,
}: {
  startPrice: number;
  simulation: MonteCarloSimulationResult;
  muDaily: number;
  sigmaDaily: number;
  priceLabel: string;
}) {
  const { stats, horizonLabel } = simulation;
  const meanDelta = stats.meanReturnPct;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded border border-neutral-800 bg-[#0d0d0d] p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
          S₀ vs Expected Mean (S_T)
        </p>
        <p className="mt-1 font-mono text-[15px] tabular-nums text-neutral-100">
          {formatPrice(startPrice)} → {formatPrice(stats.meanPrice)}
        </p>
        <p className="mt-1 font-mono text-[10px] text-neutral-500">
          {priceLabel} · {formatPct(meanDelta)} over {horizonLabel}
        </p>
      </article>

      <article className="rounded border border-neutral-800 bg-[#0d0d0d] p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
          Probability of Profit
        </p>
        <p className="mt-1 font-mono text-[18px] tabular-nums text-gain">
          {stats.profitProbability.toFixed(1)}%
        </p>
        <p className="mt-1 font-mono text-[10px] text-neutral-500">
          {horizonLabel} runs ending above {formatPrice(startPrice)}
        </p>
      </article>

      <article className="rounded border border-neutral-800 bg-[#0d0d0d] p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
          95% Value-at-Risk (vs S₀)
        </p>
        <p
          className={`mt-1 font-mono text-[18px] tabular-nums ${
            stats.var95Pct < 0 ? "text-rose-400" : "text-gain"
          }`}
        >
          {formatVar95Pct(stats.var95Pct)}
        </p>
        <p className="mt-1 font-mono text-[10px] text-neutral-500">
          5th percentile bear · {horizonLabel}
        </p>
      </article>

      <article className="rounded border border-neutral-800 bg-[#0d0d0d] p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
          Engine μ & σ (Annualized)
        </p>
        <p className="mt-1 font-mono text-[13px] tabular-nums text-amber-400">
          μ {pctFromDecimal(annualizeMu(muDaily))}
        </p>
        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-gain">
          σ {pctFromDecimal(annualizeSigma(sigmaDaily))}
        </p>
      </article>
    </div>
  );
}

function MonteCarloChart({
  rows,
  sampleKeys,
  startPrice,
  priceLabel,
  horizonDays,
  horizonLabel,
  yDomain,
  loading,
}: {
  rows: MonteCarloChartRow[];
  sampleKeys: string[];
  startPrice: number;
  priceLabel: string;
  horizonDays: number;
  horizonLabel: string;
  yDomain: [number, number];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded border border-neutral-800 bg-[#0d0d0d]">
        <p className="font-mono text-[11px] text-neutral-500">Loading price paths…</p>
      </div>
    );
  }

  const xLabel = "Trading days forward";

  return (
    <div className="h-[380px] rounded border border-neutral-800 bg-[#0d0d0d] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(day) => formatHorizonTick(Number(day), horizonDays)}
            tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "#262626" }}
            tickLine={false}
            minTickGap={24}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -2,
              fill: "#525252",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          />
          <YAxis
            tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
            tickFormatter={(value) => `RM ${Number(value).toFixed(2)}`}
            axisLine={{ stroke: "#262626" }}
            tickLine={false}
            width={60}
            domain={yDomain}
          />
          <Tooltip
            content={
              <MonteCarloTooltip
                startPrice={startPrice}
                priceLabel={priceLabel}
                horizonLabel={horizonLabel}
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
              strokeOpacity={0.18}
            />
          ))}
          <Line
            type="monotone"
            dataKey="p10"
            name="Bear (10th)"
            stroke="#f87171"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="Median (50th)"
            stroke="#fbbf24"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p90"
            name="Bull (90th)"
            stroke="#4ade80"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
  label?: string | number;
  startPrice: number;
  priceLabel: string;
  horizonLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const timeLabel = `Day +${row.day} · ${horizonLabel}`;

  return (
    <div className="rounded border border-neutral-700 bg-[#121212] px-3 py-2 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">{timeLabel}</p>
      <p className="mt-1 text-gain">Bull 90th · {formatPrice(row.p90)}</p>
      <p className="text-amber-400">Median · {formatPrice(row.p50)}</p>
      <p className="text-loss">Bear 10th · {formatPrice(row.p10)}</p>
      <p className="mt-1 text-neutral-500">
        Range {formatPrice(row.min)} – {formatPrice(row.max)}
      </p>
      <p className="text-neutral-600">
        {priceLabel} · S₀ {formatPrice(startPrice)}
      </p>
    </div>
  );
}
