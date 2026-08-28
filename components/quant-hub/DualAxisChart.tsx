"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QuantChartPoint } from "@/lib/quant/types";

type DualAxisChartProps = {
  points: QuantChartPoint[];
  factorLabel: string;
  factorUnit: string;
  priceSeriesLabel: string;
  loading: boolean;
};

function formatDate(date: string): string {
  return date.slice(5);
}

export function DualAxisChart({
  points,
  factorLabel,
  factorUnit,
  priceSeriesLabel,
  loading,
}: DualAxisChartProps) {
  const data = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        label: formatDate(point.date),
      })),
    [points],
  );

  if (loading && data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded border border-neutral-800 bg-[#0d0d0d]">
        <p className="font-mono text-[11px] text-neutral-500">Loading correlation series…</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded border border-neutral-800 bg-[#0d0d0d]">
        <p className="font-mono text-[11px] text-neutral-500">No aligned series for this pair.</p>
      </div>
    );
  }

  return (
    <div className="h-[320px] rounded border border-neutral-800 bg-[#0d0d0d] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "#262626" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            yAxisId="factor"
            tick={{ fill: "#fbbf24", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "#262626" }}
            tickLine={false}
            width={42}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: "#34d399", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "#262626" }}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#121212",
              border: "1px solid #262626",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "#a3a3a3" }}
            formatter={(value, name) => {
              if (typeof value !== "number") return [value, name];
              if (name === factorLabel) return [value.toFixed(2), `${factorLabel} (${factorUnit})`];
              return [value.toFixed(3), priceSeriesLabel];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#a3a3a3" }}
          />
          <Bar
            yAxisId="factor"
            dataKey="factorValue"
            name={factorLabel}
            fill="#fbbf24"
            fillOpacity={0.55}
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name={priceSeriesLabel}
            stroke="#34d399"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
