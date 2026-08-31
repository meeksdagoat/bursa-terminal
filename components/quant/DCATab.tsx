"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QuantAssetSelector } from "@/components/quant/QuantAssetSelector";
import { DCA_ADVANCED, LearnDCAContent } from "@/components/quant-hub/learn/dca";
import { LearnQuantModalShell } from "@/components/quant-hub/LearnQuantModalShell";
import { QuantTabToolbar } from "@/components/quant-hub/learn-quant-shared";
import {
  DEFAULT_QUANT_ASSET_SYMBOL,
  formatAssetPrice,
  resolveQuantAsset,
  type QuantAssetCurrency,
} from "@/lib/quant/asset-catalog";
import {
  DCA_FREQUENCIES,
  DCA_PERIODS,
  type DCABaseCurrency,
  type DCAFrequency,
  type DCAPeriod,
  type DCASimulatorPayload,
} from "@/lib/quant/dca-simulator";

const PANEL = "rounded border border-neutral-800 bg-[#0d0d0d] p-3";
const TAB_PILL_ACTIVE = "border-amber-500/50 bg-amber-500/15 text-amber-400";
const TAB_PILL_IDLE =
  "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300";
const TOOLBAR_SELECT =
  "rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500";

const DEFAULT_INVESTMENT_AMOUNT = 500;
const MIN_INVESTMENT_AMOUNT = 1;

function baseCurrencyToQuant(currency: DCABaseCurrency): QuantAssetCurrency {
  return currency === "USD" ? "USD" : "MYR";
}

function formatSignedMoney(value: number, currency: DCABaseCurrency): string {
  const formatted = formatAssetPrice(Math.abs(value), baseCurrencyToQuant(currency));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
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

type DCATabProps = {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

export function DCATab({ symbol, onSymbolChange }: DCATabProps) {
  const asset = resolveQuantAsset(symbol) ?? resolveQuantAsset(DEFAULT_QUANT_ASSET_SYMBOL)!;
  const [baseCurrency, setBaseCurrency] = useState<DCABaseCurrency>("MYR");
  const [investmentAmount, setInvestmentAmount] = useState(DEFAULT_INVESTMENT_AMOUNT);
  const [frequency, setFrequency] = useState<DCAFrequency>("monthly");
  const [period, setPeriod] = useState<DCAPeriod>("2y");
  const [payload, setPayload] = useState<DCASimulatorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLearnModalOpen, setIsLearnModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      symbol,
      frequency,
      period,
      baseCurrency,
      amount: String(investmentAmount),
    });

    void fetch(`/api/quant/dca-simulator?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as DCASimulatorPayload | { error?: string };
        if (!response.ok) {
          throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
        }
        return body as DCASimulatorPayload;
      })
      .then((result) => {
        if (cancelled) return;
        setPayload(result);
        if (result.warning && result.points.length === 0) {
          setError(result.warning);
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        setPayload(null);
        setError(cause instanceof Error ? cause.message : "DCA simulation failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, frequency, period, baseCurrency, investmentAmount]);

  const chartData = useMemo(() => payload?.points ?? [], [payload?.points]);
  const summary = payload?.summary;

  return (
    <>
      <div className="flex flex-col gap-3">
        <QuantTabToolbar
          title="DCA / Cost Averaging"
          learnLabel="DCA"
          onLearn={() => setIsLearnModalOpen(true)}
        />

        <section className={`flex flex-col gap-3 ${PANEL}`}>
      <div className="grid gap-3 border-b border-neutral-800 pb-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <QuantAssetSelector value={symbol} onChange={onSymbolChange} showHeader={false} />
        </div>

        <fieldset className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Base Currency
          </span>
          <div className="inline-flex rounded border border-neutral-800 bg-[#111111] p-0.5">
            {(["MYR", "USD"] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => setBaseCurrency(currency)}
                className={`rounded px-2.5 py-1 font-mono text-[10px] transition-colors ${
                  baseCurrency === currency
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[9rem] flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Investment Amount per Interval
          </span>
          <div className="flex items-center gap-1.5 rounded border border-neutral-800 bg-[#111111] px-2 py-1.5">
            <span className="shrink-0 font-mono text-[10px] text-neutral-500">
              {baseCurrency === "MYR" ? "RM" : "$"}
            </span>
            <input
              type="number"
              min={MIN_INVESTMENT_AMOUNT}
              step={50}
              value={investmentAmount}
              onChange={(event) =>
                setInvestmentAmount(
                  Math.max(MIN_INVESTMENT_AMOUNT, Number(event.target.value) || DEFAULT_INVESTMENT_AMOUNT),
                )
              }
              className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-neutral-200 outline-none"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Investment Frequency
          </span>
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as DCAFrequency)}
            className={TOOLBAR_SELECT}
          >
            {DCA_FREQUENCIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Investment Period
          </span>
          <div className="flex flex-wrap gap-1">
            {DCA_PERIODS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                  period === option.id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {payload?.warning && !error ? (
        <p className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1 font-mono text-[10px] text-amber-400">
          {payload.warning}
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading && !summary ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded border border-neutral-800 bg-[#111111]" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Total Capital Invested"
            value={formatAssetPrice(summary.totalCapitalInvested, baseCurrencyToQuant(baseCurrency))}
          />
          <MetricCard
            title="Current Portfolio Value"
            value={formatAssetPrice(summary.currentPortfolioValue, baseCurrencyToQuant(baseCurrency))}
            valueTone="text-amber-400"
          />
          <MetricCard
            title="Total Profit / Loss"
            value={`${formatSignedMoney(summary.totalProfitLoss, baseCurrency)} (${formatSignedPct(summary.totalReturnPct)})`}
            valueTone={toneForPct(summary.totalProfitLoss)}
          />
          <MetricCard
            title="Average Cost Basis"
            value={formatAssetPrice(summary.averageCostBasis, baseCurrencyToQuant(baseCurrency))}
            secondary={`Market ${formatAssetPrice(summary.currentPrice, baseCurrencyToQuant(baseCurrency))}`}
          />
          <MetricCard
            title="Total Units Accumulated"
            value={summary.totalUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            secondary={`${summary.contributionCount} contributions`}
          />
        </div>
      ) : null}

      <div className="relative flex h-[380px] flex-col rounded border border-neutral-800 bg-[#111111] p-2">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-[#111111]/85">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-amber-400" />
          </div>
        ) : null}

        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-neutral-500" aria-hidden />
            Cash Invested
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-amber-500" aria-hidden />
            DCA Portfolio Value
          </span>
        </div>

        <div className="min-h-0 flex-1">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dcaInvestedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dcaValueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => String(value).slice(2, 7)}
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(value) =>
                    formatAssetPrice(Number(value), baseCurrencyToQuant(baseCurrency)).replace(
                      /(\.\d{2})$/,
                      "",
                    )
                  }
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<DCATooltip baseCurrency={baseCurrency} assetLabel={asset.label} />} />
                <Area
                  type="stepAfter"
                  dataKey="cumulativeInvested"
                  name="Cash Invested"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  fill="url(#dcaInvestedFill)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="portfolioValue"
                  name="Portfolio Value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="portfolioValue"
                  name="Portfolio Value Area"
                  stroke="none"
                  fill="url(#dcaValueFill)"
                  dot={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[10px] text-neutral-600">
              No chart data — adjust symbol or period.
            </div>
          )}
        </div>
      </div>

      <p className="font-mono text-[9px] text-neutral-600">
        {asset.label} ({symbol}) · {frequency} DCA · {period.toUpperCase()} lookback · contributions in{" "}
        {baseCurrency}
      </p>
        </section>
      </div>

      <LearnQuantModalShell
        open={isLearnModalOpen}
        onClose={() => setIsLearnModalOpen(false)}
        title="Learn DCA & Cost Averaging"
        subtitle="Invest steadily through market ups and downs. Understand average cost basis, lump-sum trade-offs, and how to read the simulator chart."
        advancedSections={DCA_ADVANCED}
      >
        <LearnDCAContent />
      </LearnQuantModalShell>
    </>
  );
}

function MetricCard({
  title,
  value,
  secondary,
  valueTone = "text-neutral-100",
}: {
  title: string;
  value: string;
  secondary?: string;
  valueTone?: string;
}) {
  return (
    <article className="min-w-0 rounded border border-neutral-800 bg-[#111111] p-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{title}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${valueTone}`}>
        {value}
      </p>
      {secondary ? (
        <p className="mt-0.5 truncate font-mono text-[9px] text-neutral-600">{secondary}</p>
      ) : null}
    </article>
  );
}

function DCATooltip({
  active,
  payload,
  baseCurrency,
  assetLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { timestamp: string; cumulativeInvested: number; portfolioValue: number; unitPrice: number } }>;
  baseCurrency: DCABaseCurrency;
  assetLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const currency = baseCurrencyToQuant(baseCurrency);

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/90 px-2 py-1.5 font-mono text-[10px] shadow-lg">
      <p className="text-neutral-400">{row.timestamp}</p>
      <p className="text-neutral-300">
        Cash invested · {formatAssetPrice(row.cumulativeInvested, currency)}
      </p>
      <p className="text-amber-400">
        Portfolio value · {formatAssetPrice(row.portfolioValue, currency)}
      </p>
      <p className="text-neutral-500">
        {assetLabel} · {formatAssetPrice(row.unitPrice, currency)}
      </p>
    </div>
  );
}
