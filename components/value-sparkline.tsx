"use client";

import { useMemo } from "react";
import type { ValuePoint } from "@/lib/portfolio";
import { formatKlDate, formatRinggit } from "@/lib/format";

type ValueSparklineProps = {
  points: ValuePoint[];
};

export function ValueSparkline({ points }: ValueSparklineProps) {
  const { path, first, last, min, max } = useMemo(() => {
    if (points.length === 0) {
      return { path: "", first: null as number | null, last: null as number | null, min: 0, max: 0 };
    }

    const values = points.map((point) => point.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const width = 100;
    const height = 36;
    const step = points.length > 1 ? width / (points.length - 1) : 0;

    const d = points
      .map((point, index) => {
        const x = index * step;
        const y = height - ((point.value - lo) / span) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return { path: d, first: points[0].value, last: points[points.length - 1].value, min: lo, max: hi };
  }, [points]);

  if (points.length < 2) {
    return (
      <p className="py-6 text-center font-mono text-[10px] text-neutral-600">
        NOT ENOUGH HISTORY FOR THIS WINDOW
      </p>
    );
  }

  const change = first != null && last != null && first !== 0 ? ((last - first) / first) * 100 : null;
  const stroke = (change ?? 0) >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          Portfolio value
        </p>
        <p className="font-mono text-[11px] text-neutral-200">{formatRinggit(last)}</p>
      </div>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-20 w-full">
        <path d={path} fill="none" stroke={stroke} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-neutral-600">
        <span>{formatKlDate(new Date(points[0].time * 1000).toISOString())}</span>
        <span>
          {formatRinggit(min)} – {formatRinggit(max)}
        </span>
        <span>{formatKlDate(new Date(points[points.length - 1].time * 1000).toISOString())}</span>
      </div>
    </div>
  );
}
