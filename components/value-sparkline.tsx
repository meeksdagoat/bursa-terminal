"use client";

import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { ValuePoint } from "@/lib/portfolio";
import { changeClass, formatKlDate, formatKlFullDate, formatPct, formatRinggit } from "@/lib/format";

type ValueSparklineProps = {
  points: ValuePoint[];
};

type ChartRow = {
  index: number;
  time: number;
  value: number;
  returnPct: number;
  dateLabel: string;
};

type TooltipPlacement = {
  left: number;
  top: number;
};

const TOOLTIP_W = 130;
const TOOLTIP_H = 48;
const CHART_MARGIN_TOP = 10;
const CHART_MARGIN_BOTTOM = 6;

function computeTooltipPlacement(
  width: number,
  height: number,
  index: number,
  value: number,
  min: number,
  max: number,
  rowCount: number,
): TooltipPlacement {
  const xRatio = rowCount > 1 ? index / (rowCount - 1) : 0;
  const span = max - min || 1;
  const yNorm = (value - min) / span;
  const plotHeight = height - CHART_MARGIN_TOP - CHART_MARGIN_BOTTOM;
  const dotY = CHART_MARGIN_TOP + plotHeight * (1 - yNorm);

  const offsetY = -46;
  const offsetX = 12;

  let left = xRatio * width + offsetX;
  let top = dotY + offsetY;

  if (top < 2) {
    top = dotY + 14;
  }

  if (left + TOOLTIP_W > width - 4) {
    left = xRatio * width - TOOLTIP_W - offsetX;
  }

  left = Math.max(4, Math.min(left, width - TOOLTIP_W - 4));
  top = Math.max(2, Math.min(top, height - TOOLTIP_H - 2));

  return { left, top };
}

export function ValueSparkline({ points }: ValueSparklineProps) {
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ChartRow | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPlacement | null>(null);

  const chart = useMemo(() => {
    if (points.length < 2) {
      return null;
    }

    const firstValue = points[0].value;
    const lastValue = points[points.length - 1].value;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const periodReturn =
      firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : null;

    const rows: ChartRow[] = points.map((point, index) => ({
      index,
      time: point.time,
      value: point.value,
      returnPct: firstValue !== 0 ? ((point.value - firstValue) / firstValue) * 100 : 0,
      dateLabel: formatKlFullDate(new Date(point.time * 1000).toISOString()),
    }));

    const stroke = (periodReturn ?? 0) >= 0 ? "#22c55e" : "#ef4444";

    return { rows, lastValue, min, max, periodReturn, stroke };
  }, [points]);

  const pickRowAtX = useCallback(
    (clientX: number) => {
      if (!chart) return;
      const bounds = chartWrapRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

      const ratio = (clientX - bounds.left) / bounds.width;
      const index = Math.min(
        chart.rows.length - 1,
        Math.max(0, Math.round(ratio * (chart.rows.length - 1))),
      );
      const row = chart.rows[index];
      setActive(row);
      setTooltipPos(
        computeTooltipPlacement(
          bounds.width,
          bounds.height,
          row.index,
          row.value,
          chart.min,
          chart.max,
          chart.rows.length,
        ),
      );
    },
    [chart],
  );

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    pickRowAtX(event.clientX);
  }

  function handleMouseLeave() {
    setActive(null);
    setTooltipPos(null);
  }

  if (!chart) {
    return (
      <p className="py-6 text-center font-mono text-[10px] text-neutral-600">
        NOT ENOUGH HISTORY FOR THIS WINDOW
      </p>
    );
  }

  const { rows, lastValue, min, max, periodReturn, stroke } = chart;
  const displayValue = active?.value ?? lastValue;
  const displayReturn = active?.returnPct ?? periodReturn;
  const rangeLabel = `${formatRinggit(min)} – ${formatRinggit(max)}`;

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            Portfolio value
          </p>
          {active ? (
            <p className="mt-0.5 font-mono text-[9px] text-neutral-500">{active.dateLabel}</p>
          ) : (
            <p className="mt-0.5 font-mono text-[9px] text-neutral-600">{rangeLabel}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[11px] font-medium tabular-nums text-white">
            {formatRinggit(displayValue)}
          </p>
          {displayReturn != null ? (
            <p className={`font-mono text-[10px] tabular-nums ${changeClass(displayReturn)}`}>
              {formatPct(displayReturn)}
            </p>
          ) : null}
        </div>
      </div>

      <div
        ref={chartWrapRef}
        className="relative h-24 w-full cursor-crosshair overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
            <XAxis dataKey="index" hide padding={{ left: 0, right: 0 }} />
            <YAxis domain={["dataMin", "dataMax"]} hide padding={{ top: 4, bottom: 4 }} />
            {active ? (
              <>
                <ReferenceLine
                  x={active.index}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <ReferenceDot
                  x={active.index}
                  y={active.value}
                  r={3.5}
                  fill={stroke}
                  stroke="#ffffff"
                  strokeWidth={1}
                  ifOverflow="visible"
                />
              </>
            ) : null}
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {active && tooltipPos ? (
          <div
            className="pointer-events-none absolute z-10 max-w-[130px] rounded border border-neutral-700 bg-neutral-900/90 px-2 py-1 shadow-md backdrop-blur-sm"
            style={{ left: tooltipPos.left, top: tooltipPos.top }}
          >
            <p className="truncate font-mono text-[10px] leading-tight text-zinc-400">
              {active.dateLabel}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs font-bold leading-tight text-white tabular-nums">
              {formatRinggit(active.value)}
            </p>
            <p
              className={`mt-0.5 font-mono text-[10px] leading-tight tabular-nums ${changeClass(active.returnPct)}`}
            >
              {formatPct(active.returnPct)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-1 flex justify-between font-mono text-[9px] text-neutral-600">
        <span>{formatKlDate(new Date(points[0].time * 1000).toISOString())}</span>
        <span className={active ? "text-neutral-400" : undefined}>
          {active ? formatRinggit(active.value) : rangeLabel}
        </span>
        <span>{formatKlDate(new Date(points[points.length - 1].time * 1000).toISOString())}</span>
      </div>
    </div>
  );
}
