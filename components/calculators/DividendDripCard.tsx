"use client";

import { useMemo, useState } from "react";
import { NUMBER_INPUT, QUANT_CARD, QUANT_PANEL } from "@/components/quant/quant-theme";
import { projectDripSchedule } from "@/lib/calculators/drip-planner";
import { formatRinggit } from "@/lib/format";

const FIELD_LABEL = "font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500";

export function DividendDripCard() {
  const [price, setPrice] = useState(10.5);
  const [yieldPct, setYieldPct] = useState(6.2);
  const [shares, setShares] = useState(1_000);
  const [years, setYears] = useState(10);
  const [annualContribution, setAnnualContribution] = useState(0);

  const result = useMemo(
    () =>
      projectDripSchedule({
        initialShares: shares,
        price,
        yieldPct,
        years,
        annualContribution,
      }),
    [shares, price, yieldPct, years, annualContribution],
  );

  return (
    <section className={`flex flex-col gap-4 ${QUANT_PANEL}`}>
      <div>
        <h2 className="text-[13px] font-semibold text-white">Dividend Yield & DRIP Planner</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          Constant-price reinvestment schedule for high-yield Malaysian names (banks and M-REITs).
          Dividends are assumed paid annually and fully reinvested at the same price. Yields are
          illustrative placeholders — not live quotes.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Share price (RM)</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value) || 0)}
            className={NUMBER_INPUT}
          />
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Gross yield %</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={yieldPct}
            onChange={(event) => setYieldPct(Number(event.target.value) || 0)}
            className={NUMBER_INPUT}
          />
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Starting shares</span>
          <input
            type="number"
            min={0}
            step={100}
            value={shares}
            onChange={(event) => setShares(Math.max(0, Number(event.target.value) || 0))}
            className={NUMBER_INPUT}
          />
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Horizon (years)</span>
          <input
            type="number"
            min={1}
            max={40}
            step={1}
            value={years}
            onChange={(event) => setYears(Math.max(1, Number(event.target.value) || 1))}
            className={NUMBER_INPUT}
          />
        </label>
        <label className="flex min-w-[9rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Annual top-up (RM)</span>
          <input
            type="number"
            min={0}
            step={500}
            value={annualContribution}
            onChange={(event) => setAnnualContribution(Math.max(0, Number(event.target.value) || 0))}
            className={NUMBER_INPUT}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Gross yield" value={`${yieldPct.toFixed(1)}%`} />
        <Metric title="Dividends reinvested" value={formatRinggit(result.totalDividends)} />
        <Metric title="Ending shares" value={result.endingShares.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Metric title="Ending value" value={formatRinggit(result.endingValue)} tone="text-amber-400" />
      </div>

      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="min-w-full text-left font-mono text-[11px]">
          <thead className="bg-[#111111] text-[9px] uppercase tracking-[0.12em] text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Dividend</th>
              <th className="px-3 py-2 font-medium">Shares (end)</th>
              <th className="px-3 py-2 font-medium">Portfolio value</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.year} className="border-t border-neutral-800 text-neutral-200">
                <td className="px-3 py-1.5 text-neutral-500">{row.year}</td>
                <td className="px-3 py-1.5">{formatRinggit(row.dividend)}</td>
                <td className="px-3 py-1.5">
                  {row.sharesEnd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-1.5 text-amber-400">{formatRinggit(row.portfolioValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ title, value, tone = "text-neutral-100" }: { title: string; value: string; tone?: string }) {
  return (
    <article className={QUANT_CARD}>
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{title}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </article>
  );
}
