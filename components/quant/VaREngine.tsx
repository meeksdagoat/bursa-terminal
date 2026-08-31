"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QuantAssetSelector } from "@/components/quant/QuantAssetSelector";
import {
  NUMBER_INPUT,
  QUANT_CARD,
  QUANT_PANEL,
  TAB_PILL_ACTIVE,
  TAB_PILL_IDLE,
} from "@/components/quant/quant-theme";
import {
  DEFAULT_QUANT_ASSET_SYMBOL,
  formatAssetPrice,
  resolveQuantAsset,
} from "@/lib/quant/asset-catalog";
import { fetchPriceBars } from "@/lib/quant/client-history";
import {
  VAR_CONFIDENCE,
  VAR_HORIZONS,
  buildReturnHistogram,
  computeVaR,
  overlappingHorizonReturns,
  type VaRConfidence,
  type VaRHorizon,
  type VaRMethod,
} from "@/lib/quant/var-engine";

const LOOKBACK_CALENDAR_DAYS = 550;
const DEFAULT_NOTIONAL = 100_000;

function formatLossPct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

function formatCutoff(value: number): string {
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

type VaREngineProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function VaREngine({ symbol, onSymbolChange }: VaREngineProps) {
  const asset = resolveQuantAsset(symbol) ?? resolveQuantAsset(DEFAULT_QUANT_ASSET_SYMBOL)!;
  const [closes, setCloses] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<VaRMethod>("historical");
  const [horizon, setHorizon] = useState<VaRHorizon>(1);
  const [confidence, setConfidence] = useState<VaRConfidence>(95);
  const [notional, setNotional] = useState(DEFAULT_NOTIONAL);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchPriceBars([symbol], LOOKBACK_CALENDAR_DAYS)
      .then(({ series, errors }) => {
        if (cancelled) return;
        const next = (series[symbol] ?? []).map((bar) => bar.close);
        setCloses(next);
        if (next.length < 40) {
          setError(errors[0] ?? "Insufficient price history for VaR (need ≥40 sessions)");
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

  const engine = useMemo(() => computeVaR(closes), [closes]);
  const matrix = engine?.[method];
  const activeCell = matrix?.[horizon][confidence];
  const histogramReturns = useMemo(
    () => overlappingHorizonReturns(closes, horizon),
    [closes, horizon],
  );
  const histogram = useMemo(
    () => buildReturnHistogram(histogramReturns, activeCell?.cutoffReturn ?? 0),
    [histogramReturns, activeCell?.cutoffReturn],
  );
  const cutoffBin = histogram.find(
    (bin) => bin.x0 <= (activeCell?.cutoffReturn ?? 0) && bin.x1 >= (activeCell?.cutoffReturn ?? 0),
  );

  return (
    <section className={`flex flex-col gap-3 ${QUANT_PANEL}`}>
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 pb-2">
        <div className="min-w-[220px] flex-1">
          <QuantAssetSelector value={symbol} onChange={onSymbolChange} />
        </div>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          {(["parametric", "historical"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={`rounded border px-2 py-1 font-mono text-xs capitalize transition-colors ${
                method === id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {id}
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          {VAR_HORIZONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setHorizon(days)}
              className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                horizon === days ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {days}D
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          {VAR_CONFIDENCE.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setConfidence(level)}
              className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                confidence === level ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {level}%
            </button>
          ))}
        </fieldset>

        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Notional
          </span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={notional}
            onChange={(event) => setNotional(Math.max(1000, Number(event.target.value) || 0))}
            className={`${NUMBER_INPUT} w-28`}
          />
        </label>
      </div>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded border border-slate-800 bg-[#111111]" />
          ))}
        </div>
      ) : null}

      {engine && activeCell ? (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <MetricCard
              label={`${horizon}D ${confidence}% VaR`}
              value={formatLossPct(activeCell.lossFraction)}
              sub={`${method} · cutoff ${formatCutoff(activeCell.cutoffReturn)}`}
              tone="text-rose-400"
            />
            <MetricCard
              label="Capital at risk"
              value={formatAssetPrice(notional * activeCell.lossFraction, asset.currency)}
              sub={`${formatAssetPrice(notional, asset.currency)} notional`}
              tone="text-amber-400"
            />
            <MetricCard
              label="Daily mean / vol"
              value={`${formatCutoff(engine.muDaily)} / ${(engine.sigmaDaily * 100).toFixed(2)}%`}
              sub={`Ann. vol ${(engine.sigmaAnnual * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Sample"
              value={`${engine.sampleCount} sessions`}
              sub={`${histogramReturns.length} overlapping ${horizon}D returns`}
            />
          </div>

          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
                  <th className="border-b border-slate-800 px-2 py-1.5">Horizon</th>
                  <th className="border-b border-slate-800 px-2 py-1.5 text-right">95% Parametric</th>
                  <th className="border-b border-slate-800 px-2 py-1.5 text-right">99% Parametric</th>
                  <th className="border-b border-slate-800 px-2 py-1.5 text-right">95% Historical</th>
                  <th className="border-b border-slate-800 px-2 py-1.5 text-right">99% Historical</th>
                </tr>
              </thead>
              <tbody>
                {VAR_HORIZONS.map((days) => (
                  <tr key={days} className={days === horizon ? "bg-amber-500/5" : ""}>
                    <td className="border-b border-slate-800/80 px-2 py-1.5 font-mono text-[11px] text-neutral-300">
                      {days}-Day
                    </td>
                    {(["parametric", "historical"] as const).flatMap((rowMethod) =>
                      VAR_CONFIDENCE.map((level) => {
                        const cell = engine[rowMethod][days][level];
                        const active = method === rowMethod && days === horizon && level === confidence;
                        return (
                          <td
                            key={`${rowMethod}-${level}`}
                            className={`border-b border-slate-800/80 px-2 py-1.5 text-right font-mono text-[11px] tabular-nums ${
                              active ? "text-amber-400" : "text-neutral-200"
                            }`}
                          >
                            {formatLossPct(cell.lossFraction)}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-[340px] rounded border border-slate-800 bg-[#111111] p-2">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              {horizon}D return distribution · tail left of VaR cutoff
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={histogram} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#737373", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<HistogramTooltip cutoff={activeCell.cutoffReturn} />} />
                {cutoffBin ? (
                  <ReferenceLine
                    x={cutoffBin.label}
                    stroke="#f87171"
                    strokeDasharray="4 3"
                    label={{
                      value: `VaR ${formatCutoff(activeCell.cutoffReturn)}`,
                      fill: "#fb7185",
                      fontSize: 10,
                      fontFamily: "monospace",
                      position: "insideTopRight",
                    }}
                  />
                ) : null}
                <Bar dataKey="count" maxBarSize={18} isAnimationActive={false}>
                  {histogram.map((bin) => (
                    <Cell
                      key={bin.label}
                      fill={bin.isTail ? "#f43f5e" : "#475569"}
                      fillOpacity={bin.isTail ? 0.85 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : !loading && !error ? (
        <p className="font-mono text-[10px] text-neutral-500">Select a valid asset to compute VaR.</p>
      ) : null}
    </section>
  );
}

function MetricCard({
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
    <article className={QUANT_CARD}>
      <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="truncate font-mono text-[9px] text-neutral-600">{sub}</p>
    </article>
  );
}

function HistogramTooltip({
  active,
  payload,
  cutoff,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { label: string; count: number; isTail: boolean } }>;
  cutoff: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded border border-slate-700 bg-[#0a0a0a] px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-300">{row.label}</p>
      <p className="text-neutral-400">{row.count} observations</p>
      <p className={row.isTail ? "text-rose-400" : "text-neutral-500"}>
        {row.isTail ? "Tail (beyond VaR)" : "Body"} · cutoff {formatCutoff(cutoff)}
      </p>
    </div>
  );
}
