"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QuantAssetSelector } from "@/components/quant/QuantAssetSelector";
import { QUANT_CARD, QUANT_PANEL } from "@/components/quant/quant-theme";
import {
  DEFAULT_QUANT_ASSET_SYMBOL,
  formatAssetSpotPrice,
  resolveQuantAsset,
} from "@/lib/quant/asset-catalog";
import { fetchPriceBars, type PriceBar } from "@/lib/quant/client-history";
import {
  REGIME_COLORS,
  classifyRegimes,
  type MarketRegime,
  type RegimePoint,
} from "@/lib/quant/regime-classifier";

const LOOKBACK_CALENDAR_DAYS = 520;

type RegimeClassifierProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function RegimeClassifier({ symbol, onSymbolChange }: RegimeClassifierProps) {
  const asset = resolveQuantAsset(symbol) ?? resolveQuantAsset(DEFAULT_QUANT_ASSET_SYMBOL)!;
  const [bars, setBars] = useState<PriceBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchPriceBars([symbol], LOOKBACK_CALENDAR_DAYS)
      .then(({ series, errors }) => {
        if (cancelled) return;
        const next = series[symbol] ?? [];
        setBars(next);
        if (next.length < 40) {
          setError(errors[0] ?? "Insufficient history for 30D regime classification");
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        setBars([]);
        setError(cause instanceof Error ? cause.message : "History request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const result = useMemo(() => classifyRegimes(bars), [bars]);
  const latest = result?.latest ?? null;
  const total = result ? result.points.length : 0;

  return (
    <section className={`flex flex-col gap-3 ${QUANT_PANEL}`}>
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 pb-2">
        <div className="min-w-[220px] flex-1">
          <QuantAssetSelector value={symbol} onChange={onSymbolChange} />
        </div>
        <p className="max-w-xl font-mono text-[9px] leading-relaxed text-neutral-600">
          Bull / Bear from 30D return drift. Volatile when 30D realised vol clusters above 1.35× the
          90D baseline (or σann ≥ 28%). Short runs are absorbed for HMM-style persistence.
        </p>
      </div>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="h-24 animate-pulse rounded border border-slate-800 bg-[#111111]" />
      ) : null}

      {result && latest ? (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <MetricCard
              label="Active regime"
              value={REGIME_COLORS[latest.regime].label}
              sub={`30D drift ${(latest.drift30 * 100).toFixed(2)}%`}
              tone={toneForRegime(latest.regime)}
            />
            <MetricCard
              label="30D vol (ann.)"
              value={`${(latest.vol30 * 100).toFixed(1)}%`}
              sub={`90D baseline ${(latest.vol90 * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Last close"
              value={formatAssetSpotPrice(latest.close, asset)}
              sub={latest.date}
            />
            <MetricCard
              label="Regime mix"
              value={`${pct(result.counts.bull, total)} / ${pct(result.counts.bear, total)} / ${pct(result.counts.volatile, total)}`}
              sub="Bull / Bear / Volatile share"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(REGIME_COLORS) as MarketRegime[]).map((regime) => (
              <span
                key={regime}
                className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-400"
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: REGIME_COLORS[regime].stroke }}
                />
                {REGIME_COLORS[regime].label}
              </span>
            ))}
          </div>

          <div className="h-[380px] rounded border border-slate-800 bg-[#111111] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={result.points} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#737373", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  minTickGap={28}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <YAxis
                  tickFormatter={(value) => formatAssetSpotPrice(Number(value), asset)}
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  width={72}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<RegimeTooltip asset={asset} />} />
                {result.segments.map((segment, index) => (
                  <ReferenceArea
                    key={`${segment.regime}-${segment.start}-${index}`}
                    x1={segment.start}
                    x2={segment.end}
                    fill={REGIME_COLORS[segment.regime].fill}
                    fillOpacity={1}
                    ifOverflow="visible"
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#e5e7eb"
                  strokeWidth={1.7}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : !loading && !error ? (
        <p className="font-mono text-[10px] text-neutral-500">
          Select an asset with at least 30 sessions to classify regimes.
        </p>
      ) : null}
    </section>
  );
}

function pct(count: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((count / total) * 100)}%`;
}

function toneForRegime(regime: MarketRegime): string {
  if (regime === "bull") return "text-emerald-400";
  if (regime === "bear") return "text-rose-400";
  return "text-amber-400";
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

function RegimeTooltip({
  active,
  payload,
  asset,
}: {
  active?: boolean;
  payload?: Array<{ payload?: RegimePoint }>;
  asset: NonNullable<ReturnType<typeof resolveQuantAsset>>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const color = REGIME_COLORS[row.regime];
  return (
    <div className="rounded border border-slate-700 bg-[#0a0a0a] px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">{row.date}</p>
      <p className="text-neutral-100">{formatAssetSpotPrice(row.close, asset)}</p>
      <p style={{ color: color.stroke }}>{color.label}</p>
      <p className="text-neutral-500">
        Drift {(row.drift30 * 100).toFixed(2)}% · σ30 {(row.vol30 * 100).toFixed(1)}%
      </p>
    </div>
  );
}
