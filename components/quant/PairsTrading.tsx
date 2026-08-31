"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QuantAssetSelector } from "@/components/quant/QuantAssetSelector";
import {
  QUANT_CARD,
  QUANT_PANEL,
  TAB_PILL_ACTIVE,
  TAB_PILL_IDLE,
} from "@/components/quant/quant-theme";
import { formatQuantAssetLabel } from "@/constants/quantAssets";
import { resolveQuantAsset } from "@/lib/quant/asset-catalog";
import { fetchPriceBars, type PriceBar } from "@/lib/quant/client-history";
import {
  PAIRS_WINDOWS,
  PAIRS_Z_ENTRY,
  alignPairBars,
  rollingZScore,
  type PairsWindow,
} from "@/lib/quant/pairs-trading";

const LOOKBACK_CALENDAR_DAYS = 550;
const DEFAULT_LEG_B = "1295.KL";

type PairsTradingProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function PairsTrading({ symbol, onSymbolChange }: PairsTradingProps) {
  const [legB, setLegB] = useState(symbol === DEFAULT_LEG_B ? "1155.KL" : DEFAULT_LEG_B);
  const [lookback, setLookback] = useState<PairsWindow>(60);
  const [seriesA, setSeriesA] = useState<PriceBar[]>([]);
  const [seriesB, setSeriesB] = useState<PriceBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (symbol !== legB) return;
    setLegB(symbol === DEFAULT_LEG_B ? "1155.KL" : DEFAULT_LEG_B);
  }, [symbol, legB]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchPriceBars([symbol, legB], LOOKBACK_CALENDAR_DAYS)
      .then(({ series, errors }) => {
        if (cancelled) return;
        const nextA = series[symbol] ?? [];
        const nextB = series[legB] ?? [];
        setSeriesA(nextA);
        setSeriesB(nextB);
        if (nextA.length < 40 || nextB.length < 40) {
          setError(errors[0] ?? "Need ≥40 overlapping sessions on both legs");
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        setSeriesA([]);
        setSeriesB([]);
        setError(cause instanceof Error ? cause.message : "History request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, legB]);

  const result = useMemo(() => {
    const aligned = alignPairBars(seriesA, seriesB);
    if (aligned.length < lookback + 5) return null;
    return rollingZScore(aligned, lookback);
  }, [seriesA, seriesB, lookback]);

  const labelA = pairLabel(symbol);
  const labelB = pairLabel(legB);

  const signalCopy =
    result?.signal === "short_spread"
      ? `Z ≥ +${PAIRS_Z_ENTRY.toFixed(1)} · short ${symbol} / long ${legB}`
      : result?.signal === "long_spread"
        ? `Z ≤ −${PAIRS_Z_ENTRY.toFixed(1)} · long ${symbol} / short ${legB}`
        : `Inside ±${PAIRS_Z_ENTRY.toFixed(1)} · no entry`;

  return (
    <section className={`flex flex-col gap-3 ${QUANT_PANEL}`}>
      <div className="grid gap-3 border-b border-slate-800 pb-2 lg:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">Leg A</p>
          <QuantAssetSelector value={symbol} onChange={onSymbolChange} />
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">Leg B</p>
          <QuantAssetSelector value={legB} onChange={setLegB} />
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
          Rolling window
        </span>
        {PAIRS_WINDOWS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setLookback(days)}
            className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
              lookback === days ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
            }`}
          >
            {days}D
          </button>
        ))}
      </fieldset>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="h-24 animate-pulse rounded border border-slate-800 bg-[#111111]" />
      ) : null}

      {result?.latest ? (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <MetricCard
              label="Z-score"
              value={result.latest.zScore.toFixed(2)}
              sub={signalCopy}
              tone={
                Math.abs(result.latest.zScore) >= PAIRS_Z_ENTRY ? "text-amber-400" : "text-neutral-100"
              }
            />
            <MetricCard
              label="Price ratio"
              value={result.latest.ratio.toFixed(4)}
              sub={`${symbol} / ${legB}`}
            />
            <MetricCard
              label={`${lookback}D mean ± σ`}
              value={`${result.latest.mean.toFixed(4)} ± ${result.latest.std.toFixed(4)}`}
              sub="Rolling ratio stats"
            />
            <MetricCard
              label="Return corr"
              value={result.correlation == null ? "—" : result.correlation.toFixed(3)}
              sub={`${lookback}D overlapping returns`}
            />
          </div>

          <div className="h-[360px] rounded border border-slate-800 bg-[#111111] p-2">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Z-score spread · {labelA} vs {labelB} · entry ±{PAIRS_Z_ENTRY.toFixed(1)}σ
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={result.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  width={36}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<PairsTooltip symbolA={symbol} symbolB={legB} />} />
                <ReferenceLine y={PAIRS_Z_ENTRY} stroke="#fbbf24" strokeDasharray="4 3" />
                <ReferenceLine y={-PAIRS_Z_ENTRY} stroke="#fbbf24" strokeDasharray="4 3" />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
                <Line
                  type="monotone"
                  dataKey="zScore"
                  stroke="#e5e7eb"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : !loading && !error ? (
        <p className="font-mono text-[10px] text-neutral-500">
          Choose two tickers with overlapping history (e.g. 1155.KL vs 1295.KL).
        </p>
      ) : null}
    </section>
  );
}

function pairLabel(symbol: string): string {
  const asset = resolveQuantAsset(symbol);
  return asset ? formatQuantAssetLabel(asset) : symbol;
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

function PairsTooltip({
  active,
  payload,
  symbolA,
  symbolB,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: { date: string; zScore: number; ratio: number; priceA: number; priceB: number };
  }>;
  symbolA: string;
  symbolB: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded border border-slate-700 bg-[#0a0a0a] px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">{row.date}</p>
      <p className="text-amber-400">Z {row.zScore.toFixed(2)}</p>
      <p className="text-neutral-300">
        Ratio {row.ratio.toFixed(4)} · {symbolA} {row.priceA.toFixed(3)} / {symbolB} {row.priceB.toFixed(3)}
      </p>
    </div>
  );
}
