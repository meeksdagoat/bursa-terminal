"use client";

import { useMemo, useState } from "react";
import { stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { TableSkeleton } from "@/components/skeleton";
import { changeClass, formatCompact, formatEps, formatPct, formatRatio } from "@/lib/format";
import type { AnnualResult, FundamentalsPayload, FundamentalsProfitLine, QuarterlyResult } from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 30 * 60 * 1000;

type CorporatePerformanceProps = {
  symbol: string;
  companyName: string;
};

export function CorporatePerformance({ symbol, companyName }: CorporatePerformanceProps) {
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const url = `/api/fundamentals?symbol=${encodeURIComponent(symbol)}`;
  const { data, error, loading } = useLiveData<FundamentalsPayload>(url, REFRESH_MS);

  const ready = data?.symbol === symbol;
  const payload = ready ? data : null;
  const pending = !ready || (loading && !payload);

  if (error && !payload) {
    return <FeedNote text={`FUNDAMENTALS FEED UNAVAILABLE · ${error}`} />;
  }
  if (pending) {
    return <TableSkeleton rows={8} cols={5} />;
  }
  if (!payload) {
    return <FeedNote text={`NO FUNDAMENTALS FOR ${companyName.toUpperCase()}`} />;
  }

  const quarterly = withComputedYoy(payload.quarterly);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 font-mono text-xs text-neutral-400 border-b border-line">
        <SeriesToggle
          label="Revenue"
          swatch="#38bdf8"
          checked={showRevenue}
          onChange={() => setShowRevenue((value) => !value)}
        />
        <SeriesToggle
          label="Net profit"
          swatch="#22c55e"
          checked={showProfit}
          onChange={() => setShowProfit((value) => !value)}
        />
        <span className="flex-shrink-0 whitespace-nowrap">
          {payload.source === "yahoo" ? "YAHOO FINANCE" : "LIVE SERIES"}
        </span>
        {payload.source === "yahoo" ? (
          <span className="flex-shrink-0 whitespace-nowrap">REPORTED ACTUALS</span>
        ) : null}
        <span className="flex-shrink-0 whitespace-nowrap">{payload.currency}</span>
        <span className="flex-shrink-0 whitespace-nowrap">{symbol}</span>
      </div>
      <div className="flex flex-col gap-4 overflow-x-auto px-2.5 py-3">

      <RevenueProfitChart
        rows={[...payload.annual].slice().reverse()}
        showRevenue={showRevenue}
        showProfit={showProfit}
      />

      <DataTable title="Quarterly performance">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <StickyTh align="left">Quarter</StickyTh>
              <StickyTh>Revenue (RM)</StickyTh>
              <StickyTh>Rev YoY</StickyTh>
              <StickyTh>Net profit (RM)</StickyTh>
              <StickyTh>NP YoY</StickyTh>
              <StickyTh>EPS (RM)</StickyTh>
              <StickyTh>EPS YoY</StickyTh>
            </tr>
          </thead>
          <tbody>
            {quarterly.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-neutral-600"
                >
                  No reported quarters
                </td>
              </tr>
            ) : (
              quarterly.map((row, index) => (
              <tr key={row.period} className={stripe(index)}>
                <td className={`${stickyCellClass} font-mono text-neutral-100`}>
                  {row.period}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatCompact(row.revenue)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${changeClass(row.revenueYoyPct)}`}
                >
                  {formatPct(row.revenueYoyPct)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatCompact(row.netProfit)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${changeClass(row.netProfitYoyPct)}`}
                >
                  {formatPct(row.netProfitYoyPct)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatEps(row.eps)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${changeClass(row.epsYoyPct)}`}
                >
                  {formatPct(row.epsYoyPct)}
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </DataTable>

      <DataTable title="Annual performance">
        <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <StickyTh align="left">Year</StickyTh>
              <StickyTh>Revenue (RM)</StickyTh>
              <StickyTh>
                {payload.profitLine === "netInterestIncome"
                  ? "Net interest income (RM)"
                  : "Gross profit (RM)"}
              </StickyTh>
              <StickyTh>Net income (RM)</StickyTh>
              <StickyTh>Op. cash flow (RM)</StickyTh>
              <StickyTh>Debt / Equity</StickyTh>
            </tr>
          </thead>
          <tbody>
            {payload.annual.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-neutral-600"
                >
                  No reported annuals
                </td>
              </tr>
            ) : (
              payload.annual.map((row, index) => (
              <tr key={row.year} className={stripe(index)}>
                <td className={`${stickyCellClass} font-mono text-neutral-100`}>
                  {row.year}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatCompact(row.revenue)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${
                    marginValue(row, payload.profitLine) == null
                      ? "text-neutral-600"
                      : "text-neutral-200"
                  }`}
                >
                  {formatMargin(row, payload.profitLine)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${changeClass(row.netIncome)}`}
                >
                  {formatCompact(row.netIncome)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatCompact(row.operatingCashFlow)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-300`}>
                  {formatRatio(row.debtToEquity)}
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </DataTable>
      </div>
    </div>
  );
}

function RevenueProfitChart({
  rows,
  showRevenue,
  showProfit,
}: {
  rows: AnnualResult[];
  showRevenue: boolean;
  showProfit: boolean;
}) {
  const geometry = useMemo(() => {
    const revenues = rows.flatMap((row) => (row.revenue == null ? [] : [row.revenue]));
    const profits = rows.flatMap((row) => (row.netIncome == null ? [] : [Math.abs(row.netIncome)]));
    return {
      maxRevenue: Math.max(...revenues, 1),
      maxProfit: Math.max(...profits, 1),
    };
  }, [rows]);

  const width = 640;
  const height = 118;
  const pad = { top: 10, right: 6, bottom: 22, left: 6 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const groupW = innerW / Math.max(rows.length, 1);
  const barW = Math.min(10, groupW * 0.32);

  return (
    <div className="border border-line bg-[#0e0e0e]">
      <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Annual revenue vs net profit
        </h3>
        <span className="font-mono text-[9px] text-neutral-600">SERIES SCALED INDEPENDENTLY</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[118px] w-full"
        role="img"
        aria-label="Annual revenue versus net profit"
      >
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          stroke="#1f1f1f"
        />
        {rows.length === 0 ? (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#525252"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            NO REPORTED ANNUALS
          </text>
        ) : (
          rows.map((row, index) => {
          const cx = pad.left + groupW * index + groupW / 2;
          const revenueH = row.revenue == null ? 0 : (row.revenue / geometry.maxRevenue) * innerH;
          const profitH =
            row.netIncome == null ? 0 : (Math.abs(row.netIncome) / geometry.maxProfit) * innerH;
          const revenueX = cx - (showRevenue && showProfit ? barW + 1 : barW / 2);
          const profitX = showRevenue && showProfit ? cx + 1 : cx - barW / 2;
          const profitColor = (row.netIncome ?? 0) < 0 ? "#ef4444" : "#22c55e";

          return (
            <g key={row.year}>
              {showRevenue && row.revenue != null ? (
                <rect
                  x={revenueX}
                  y={pad.top + innerH - revenueH}
                  width={barW}
                  height={Math.max(revenueH, 1)}
                  fill="#38bdf8"
                  opacity={0.85}
                >
                  <title>{`${row.year} revenue ${formatCompact(row.revenue)}`}</title>
                </rect>
              ) : null}
              {showProfit && row.netIncome != null ? (
                <rect
                  x={profitX}
                  y={pad.top + innerH - profitH}
                  width={barW}
                  height={Math.max(profitH, 1)}
                  fill={profitColor}
                >
                  <title>{`${row.year} net profit ${formatCompact(row.netIncome)}`}</title>
                </rect>
              ) : null}
              <text
                x={cx}
                y={height - 7}
                textAnchor="middle"
                fill="#737373"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
              >
                {String(row.year).slice(2)}
              </text>
            </g>
          );
        })
        )}
        {!showRevenue && !showProfit ? (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#525252"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            TOGGLE A SERIES
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function DataTable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x border border-line">{children}</div>
    </section>
  );
}

function StickyTh({
  children,
  align = "right",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`${align === "left" ? stickyHeadClass : `${tableHeadClass} text-right`} ${
        align === "left" ? "text-left" : ""
      }`}
    >
      {children}
    </th>
  );
}

function SeriesToggle({
  label,
  swatch,
  checked,
  onChange,
}: {
  label: string;
  swatch: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider text-neutral-500 md:min-h-0">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-gain" />
      <span className="h-2 w-2 shrink-0" style={{ backgroundColor: swatch }} />
      {label}
    </label>
  );
}

function FeedNote({ text }: { text: string }) {
  return (
    <p className="px-2.5 py-3 font-mono text-[10px] leading-relaxed text-neutral-600">{text}</p>
  );
}

function stripe(index: number): string {
  return index % 2 === 1 ? "bg-[#101010] hover:bg-[#161616]" : "hover:bg-[#161616]";
}

function withComputedYoy(rows: QuarterlyResult[]): QuarterlyResult[] {
  const byKey = new Map(rows.map((row) => [`${row.fiscalYear}-${row.quarter}`, row]));
  return rows.map((row) => {
    const prior = byKey.get(`${row.fiscalYear - 1}-${row.quarter}`);
    return {
      ...row,
      revenueYoyPct: row.revenueYoyPct ?? quarterYoy(row.revenue, prior?.revenue ?? null),
      netProfitYoyPct: row.netProfitYoyPct ?? quarterYoy(row.netProfit, prior?.netProfit ?? null),
      epsYoyPct: row.epsYoyPct ?? quarterYoy(row.eps, prior?.eps ?? null),
    };
  });
}

function quarterYoy(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function marginValue(
  row: AnnualResult,
  line: FundamentalsProfitLine | undefined,
): number | null {
  return line === "netInterestIncome" ? (row.netInterestIncome ?? null) : row.grossProfit;
}

function formatMargin(row: AnnualResult, line: FundamentalsProfitLine | undefined): string {
  const value = marginValue(row, line);
  if (value != null) return formatCompact(value);
  return line === "netInterestIncome" ? "N/A" : "—";
}
