"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { UnitTrustFund } from "@/lib/unit-trust/types";
import { changeClass, formatPct } from "@/lib/format";

type UnitTrustChartProps = {
  fund: UnitTrustFund | null;
};

type ChartRow = {
  year: string;
  nav: number;
  distributionSen: number | null;
  distributionYieldPct: number | null;
};

export function UnitTrustChart({ fund }: UnitTrustChartProps) {
  const rows = useMemo<ChartRow[]>(() => {
    if (!fund) return [];
    return fund.history.map((point) => ({
      year: String(point.year),
      nav: point.nav,
      distributionSen: point.distributionSen,
      distributionYieldPct: point.distributionYieldPct,
    }));
  }, [fund?.id, fund?.history]);

  if (!fund) {
    return (
      <section className="flex h-full min-h-[280px] items-center justify-center border border-line bg-[#121212] p-4">
        <p className="font-mono text-[10px] text-neutral-600">
          SELECT A FUND TO VIEW NAV &amp; DISTRIBUTION HISTORY
        </p>
      </section>
    );
  }

  const isFixed = fund.priceType === "Fixed";

  return (
    <section className="flex min-h-[320px] flex-col border border-line bg-[#121212] p-3">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-800 pb-2">
        <div className="min-w-0">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Historical analytics
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-neutral-200">{fund.name}</p>
          <p className="font-mono text-[9px] text-neutral-600">
            {fund.provider} · {fund.priceType} · {fund.history.length}-year track
          </p>
        </div>
        <div className="text-right font-mono text-[10px]">
          <p className="text-neutral-500">Latest NAV</p>
          <p className="text-white tabular-nums">
            RM {isFixed ? fund.currentNav.toFixed(2) : fund.currentNav.toFixed(4)}
          </p>
          {fund.return1yPct != null ? (
            <p className={`tabular-nums ${changeClass(fund.return1yPct)}`}>
              1Y {formatPct(fund.return1yPct)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            key={fund.id}
            data={rows}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="nav"
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              tickFormatter={(value) => `RM ${Number(value).toFixed(isFixed ? 2 : 3)}`}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
              width={64}
              domain={isFixed ? [0.95, 1.05] : ["auto", "auto"]}
            />
            <YAxis
              yAxisId="dist"
              orientation="right"
              tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
              tickFormatter={(value) => `${Number(value).toFixed(1)}s`}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "4 4" }}
              content={(props) => (
                <UnitTrustChartTooltip active={props.active} payload={props.payload} isFixed={isFixed} />
              )}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="dist"
              dataKey="distributionSen"
              fill="#a78bfa"
              fillOpacity={0.35}
              barSize={14}
              name="Distribution"
              isAnimationActive={false}
            />
            <Line
              yAxisId="nav"
              type="monotone"
              dataKey="nav"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#22c55e", stroke: "#0a0a0a" }}
              name="NAV"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 font-mono text-[9px] text-neutral-600">
        Green line = NAV/unit · Violet bars = annual distribution (sen/unit). NAV from FIMM daily
        bulletin; distributions from published UTMC annual figures.
      </p>
    </section>
  );
}

function UnitTrustChartTooltip({
  active,
  payload,
  isFixed,
}: {
  active?: boolean;
  payload?: TooltipContentProps<number, string>["payload"];
  isFixed: boolean;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div className="rounded border border-neutral-700 bg-neutral-900/90 px-2.5 py-2 font-mono text-[10px] shadow-lg backdrop-blur-sm">
      <p className="text-neutral-400">{row.year}</p>
      <p className="mt-0.5 text-white tabular-nums">
        NAV RM {isFixed ? row.nav.toFixed(2) : row.nav.toFixed(4)}
      </p>
      {row.distributionSen != null ? (
        <p className="mt-0.5 text-violet-300 tabular-nums">
          Distribution {row.distributionSen.toFixed(2)} sen/unit
        </p>
      ) : null}
      {row.distributionYieldPct != null ? (
        <p className={`mt-0.5 tabular-nums ${changeClass(row.distributionYieldPct)}`}>
          Yield {formatPct(row.distributionYieldPct)}
        </p>
      ) : null}
    </div>
  );
}
