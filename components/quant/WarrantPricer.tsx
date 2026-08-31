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
  NUMBER_INPUT,
  QUANT_CARD,
  QUANT_PANEL,
  RANGE_INPUT,
  TAB_PILL_ACTIVE,
  TAB_PILL_IDLE,
} from "@/components/quant/quant-theme";
import {
  DEFAULT_QUANT_ASSET_SYMBOL,
  formatAssetSpotPrice,
  resolveQuantAsset,
} from "@/lib/quant/asset-catalog";
import { blackScholes, priceCurve, type WarrantType } from "@/lib/quant/black-scholes";
import { fetchPriceBars } from "@/lib/quant/client-history";

const DEFAULT_RATE = 0.03;

type WarrantPricerProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function WarrantPricer({ symbol, onSymbolChange }: WarrantPricerProps) {
  const asset = resolveQuantAsset(symbol) ?? resolveQuantAsset(DEFAULT_QUANT_ASSET_SYMBOL)!;
  const [spot, setSpot] = useState(10);
  const [strike, setStrike] = useState(10);
  const [expiryDays, setExpiryDays] = useState(90);
  const [impliedVol, setImpliedVol] = useState(0.28);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [type, setType] = useState<WarrantType>("call");
  const [spotHint, setSpotHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPriceBars([symbol], 40)
      .then(({ series }) => {
        if (cancelled) return;
        const last = series[symbol]?.at(-1)?.close;
        if (last == null || last <= 0) {
          setSpotHint("No spot — enter underlying manually");
          return;
        }
        setSpot(Number(last.toFixed(4)));
        setStrike(Number(last.toFixed(4)));
        setSpotHint(`Seeded from last close of ${asset.label}`);
      })
      .catch(() => {
        if (!cancelled) setSpotHint("Spot feed unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, asset.label]);

  const timeYears = expiryDays / 365;
  const result = useMemo(
    () =>
      blackScholes({
        spot,
        strike,
        timeYears,
        volatility: impliedVol,
        rate,
        type,
      }),
    [impliedVol, rate, spot, strike, timeYears, type],
  );

  const curve = useMemo(
    () =>
      priceCurve({
        spot,
        strike,
        timeYears,
        volatility: impliedVol,
        rate,
        type,
      }),
    [impliedVol, rate, spot, strike, timeYears, type],
  );

  const sliderMax = Math.max(20, strike * 2, spot * 2);

  return (
    <section className={`flex flex-col gap-3 ${QUANT_PANEL}`}>
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 pb-2">
        <div className="min-w-[220px] flex-1">
          <QuantAssetSelector value={symbol} onChange={onSymbolChange} />
        </div>
        <fieldset className="flex gap-1.5">
          {(["call", "put"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setType(id)}
              className={`rounded border px-3 py-1 font-mono text-xs uppercase transition-colors ${
                type === id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
              }`}
            >
              {id}
            </button>
          ))}
        </fieldset>
        {spotHint ? (
          <span className="font-mono text-[9px] text-neutral-600">{spotHint}</span>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-3">
          <SliderField
            label="Underlying Price"
            display={formatAssetSpotPrice(spot, asset)}
            min={0.05}
            max={sliderMax}
            step={0.01}
            value={spot}
            onChange={setSpot}
          />
          <SliderField
            label="Strike"
            display={formatAssetSpotPrice(strike, asset)}
            min={0.05}
            max={sliderMax}
            step={0.01}
            value={strike}
            onChange={setStrike}
          />
          <SliderField
            label="Expiry"
            display={`${expiryDays}d · ${timeYears.toFixed(3)}y`}
            min={1}
            max={730}
            step={1}
            value={expiryDays}
            onChange={setExpiryDays}
          />
          <SliderField
            label="Implied Volatility"
            display={`${(impliedVol * 100).toFixed(1)}%`}
            min={0.05}
            max={1.2}
            step={0.005}
            value={impliedVol}
            onChange={setImpliedVol}
          />
          <label className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Risk-free rate
            </span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={15}
                step={0.05}
                value={Number((rate * 100).toFixed(2))}
                onChange={(event) => setRate(Math.max(0, Number(event.target.value) || 0) / 100)}
                className={`${NUMBER_INPUT} w-20`}
              />
              <span className="font-mono text-[10px] text-neutral-500">%</span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          <MetricCard
            label={`${type === "call" ? "Call" : "Put"} theoretical`}
            value={formatAssetSpotPrice(result.price, asset)}
            sub={`Intrinsic ${formatAssetSpotPrice(result.intrinsic, asset)}`}
            tone="text-amber-400"
          />
          <MetricCard
            label="Time value"
            value={formatAssetSpotPrice(result.timeValue, asset)}
            sub={`Moneyness ${result.moneyness.toFixed(3)}×`}
          />
          <MetricCard label="Delta" value={result.delta.toFixed(4)} sub="∂V / ∂S" />
          <MetricCard label="Gamma" value={result.gamma.toFixed(4)} sub="∂²V / ∂S²" />
          <MetricCard
            label="Theta"
            value={result.theta.toFixed(4)}
            sub="Value decay / calendar day"
            tone={result.theta < 0 ? "text-rose-400" : "text-neutral-100"}
          />
          <MetricCard label="Vega" value={result.vega.toFixed(4)} sub="Per 1 vol point" />
        </div>
      </div>

      <div className="h-[280px] rounded border border-slate-800 bg-[#111111] p-2">
        <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
          Theoretical price vs spot · strike marked
        </p>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={curve} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="spot"
              tickFormatter={(value) => Number(value).toFixed(1)}
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => Number(value).toFixed(2)}
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #334155",
                fontFamily: "monospace",
                fontSize: 10,
              }}
              formatter={(value) =>
                typeof value === "number" ? formatAssetSpotPrice(value, asset) : String(value)
              }
              labelFormatter={(value) => `Spot ${formatAssetSpotPrice(Number(value), asset)}`}
            />
            <ReferenceLine x={strike} stroke="#64748b" strokeDasharray="3 3" />
            <ReferenceLine x={spot} stroke="#fbbf24" strokeDasharray="4 2" />
            <Line
              type="monotone"
              dataKey="intrinsic"
              stroke="#64748b"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="theoretical"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SliderField({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">{label}</span>
        <span className="font-mono text-[11px] text-amber-400">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={RANGE_INPUT}
      />
    </label>
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
