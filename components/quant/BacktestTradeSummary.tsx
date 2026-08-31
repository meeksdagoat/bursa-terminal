"use client";

import { useMemo, useState } from "react";
import { analyzeBacktestTrades } from "@/lib/quant/backtest-trade-analytics";
import type { BacktestResult } from "@/lib/quant/backtest";
import {
  formatBacktestTooltipLabel,
  type BacktestTimeframe,
} from "@/lib/quant/backtest-timeframe";
import { formatAssetPrice, type QuantAssetCurrency } from "@/lib/quant/asset-catalog";

const TABLE_CELL = "px-2 py-1.5 text-left align-middle";
const TABLE_HEAD = "px-2 py-1.5 text-left font-medium text-neutral-500";

type BacktestTradeSummaryProps = {
  result: BacktestResult;
  currency: QuantAssetCurrency;
  timeframe: BacktestTimeframe;
};

function formatMoney(value: number, currency: QuantAssetCurrency): string {
  return formatAssetPrice(value, currency);
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function StatCard({
  label,
  value,
  tone = "text-neutral-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className="min-w-0 rounded border border-neutral-800 bg-[#111111] p-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </article>
  );
}

function DirectionalComparisonTable({
  analytics,
  currency,
}: {
  analytics: ReturnType<typeof analyzeBacktestTrades>;
  currency: QuantAssetCurrency;
}) {
  const rows: {
    label: string;
    long: string;
    short: string;
    combined: string;
  }[] = [
    {
      label: "Total Trades",
      long: String(analytics.long.totalTrades),
      short: String(analytics.short.totalTrades),
      combined: String(analytics.combined.totalTrades),
    },
    {
      label: "Win Rate (%)",
      long: `${analytics.long.winRatePct.toFixed(1)}%`,
      short: `${analytics.short.winRatePct.toFixed(1)}%`,
      combined: `${analytics.combined.winRatePct.toFixed(1)}%`,
    },
    {
      label: "Gross Profit",
      long: formatMoney(analytics.long.grossProfit, currency),
      short: formatMoney(analytics.short.grossProfit, currency),
      combined: formatMoney(analytics.combined.grossProfit, currency),
    },
    {
      label: "Gross Loss",
      long: formatMoney(analytics.long.grossLoss, currency),
      short: formatMoney(analytics.short.grossLoss, currency),
      combined: formatMoney(analytics.combined.grossLoss, currency),
    },
    {
      label: "Profit Factor",
      long: analytics.long.profitFactor.toFixed(2),
      short: analytics.short.profitFactor.toFixed(2),
      combined: analytics.combined.profitFactor.toFixed(2),
    },
    {
      label: "Avg Hold Time",
      long: `${analytics.long.avgHoldBars.toFixed(1)} bars`,
      short: `${analytics.short.avgHoldBars.toFixed(1)} bars`,
      combined: `${analytics.combined.avgHoldBars.toFixed(1)} bars`,
    },
  ];

  return (
    <div className="overflow-x-auto rounded border border-neutral-800 bg-[#111111]">
      <table className="min-w-full border-collapse font-mono text-xs text-neutral-200">
        <thead>
          <tr className="border-b border-neutral-800 bg-[#0d0d0d] text-[10px] uppercase tracking-[0.12em]">
            <th className={TABLE_HEAD}>Metric</th>
            <th className={TABLE_HEAD}>Long Positions</th>
            <th className={TABLE_HEAD}>Short Positions</th>
            <th className={TABLE_HEAD}>Combined / Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-neutral-800/80 last:border-b-0">
              <td className={`${TABLE_CELL} text-neutral-400`}>{row.label}</td>
              <td className={`${TABLE_CELL} tabular-nums`}>{row.long}</td>
              <td className={`${TABLE_CELL} tabular-nums`}>{row.short}</td>
              <td className={`${TABLE_CELL} tabular-nums text-neutral-100`}>{row.combined}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BacktestTradeSummary({ result, currency, timeframe }: BacktestTradeSummaryProps) {
  const [logOpen, setLogOpen] = useState(true);
  const analytics = useMemo(
    () => analyzeBacktestTrades(result.trades ?? [], result.metrics),
    [result.metrics, result.trades],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Trade Execution &amp; Performance Summary
        </h3>
        <span className="font-mono text-[10px] text-neutral-600">
          {analytics.combined.totalTrades} closed trades
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Long / Short Ratio" value={analytics.longShortRatioLabel} />
        <StatCard
          label="Max Drawdown"
          value={`${analytics.maxDrawdownPct.toFixed(2)}%`}
          tone="text-rose-400"
        />
        <StatCard label="Payoff Ratio (Avg Win / Avg Loss)" value={analytics.payoffRatio.toFixed(2)} />
        <StatCard
          label="Max Consecutive Wins / Losses"
          value={`${analytics.maxConsecutiveWins} W / ${analytics.maxConsecutiveLosses} L`}
        />
      </div>

      <DirectionalComparisonTable analytics={analytics} currency={currency} />

      <div className="rounded border border-neutral-800 bg-[#111111]">
        <button
          type="button"
          onClick={() => setLogOpen((open) => !open)}
          className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400 hover:text-neutral-200"
        >
          <span>Recent Executions Log</span>
          <span className="text-neutral-600">{logOpen ? "Hide" : "Show"} · top 20</span>
        </button>

        {logOpen ? (
          <div className="overflow-x-auto border-t border-neutral-800">
            <table className="min-w-full border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0d0d0d] text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                  <th className={TABLE_HEAD}>Trade #</th>
                  <th className={TABLE_HEAD}>Type</th>
                  <th className={TABLE_HEAD}>Entry Time</th>
                  <th className={TABLE_HEAD}>Entry Price</th>
                  <th className={TABLE_HEAD}>Exit Time</th>
                  <th className={TABLE_HEAD}>Exit Price</th>
                  <th className={TABLE_HEAD}>PnL ($)</th>
                  <th className={TABLE_HEAD}>PnL (%)</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentTrades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-neutral-600">
                      No closed trades in the evaluation window.
                    </td>
                  </tr>
                ) : (
                  analytics.recentTrades.map((trade) => {
                    const pnlTone = trade.pnlDollar >= 0 ? "text-emerald-400" : "text-rose-400";
                    return (
                      <tr key={trade.id} className="border-b border-neutral-800/70 last:border-b-0">
                        <td className={`${TABLE_CELL} tabular-nums text-neutral-400`}>{trade.id}</td>
                        <td className={`${TABLE_CELL} ${pnlTone}`}>{trade.direction}</td>
                        <td className={`${TABLE_CELL} text-neutral-300`}>
                          {formatBacktestTooltipLabel(trade.entryDate, timeframe)}
                        </td>
                        <td className={`${TABLE_CELL} tabular-nums`}>
                          {formatAssetPrice(trade.entryPrice, currency)}
                        </td>
                        <td className={`${TABLE_CELL} text-neutral-300`}>
                          {formatBacktestTooltipLabel(trade.exitDate, timeframe)}
                        </td>
                        <td className={`${TABLE_CELL} tabular-nums`}>
                          {formatAssetPrice(trade.exitPrice, currency)}
                        </td>
                        <td className={`${TABLE_CELL} tabular-nums ${pnlTone}`}>
                          {formatMoney(trade.pnlDollar, currency)}
                        </td>
                        <td className={`${TABLE_CELL} tabular-nums ${pnlTone}`}>
                          {formatPct(trade.pnlPct)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
