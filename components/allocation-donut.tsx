"use client";

type Slice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type AllocationDonutProps = {
  slices: Slice[];
};

const RADIUS = 42;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AllocationDonut({ slices }: AllocationDonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg viewBox="0 0 120 120" className="h-[168px] w-[168px] shrink-0">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="#1f1f1f"
          strokeWidth={STROKE}
        />
        {total > 0
          ? slices.map((slice) => {
              const length = (slice.value / total) * CIRCUMFERENCE;
              const circle = (
                <circle
                  key={slice.id}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform="rotate(-90 60 60)"
                />
              );
              offset += length;
              return circle;
            })
          : null}
        <text
          x="60"
          y="57"
          textAnchor="middle"
          className="fill-neutral-500"
          fontSize="8"
          fontFamily="ui-monospace, monospace"
        >
          ALLOCATION
        </text>
        <text
          x="60"
          y="70"
          textAnchor="middle"
          className="fill-neutral-200"
          fontSize="11"
          fontFamily="ui-monospace, monospace"
        >
          {slices.length} SHARES
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((slice) => {
          const weight = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <li key={slice.id} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-200">
                {slice.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                {weight.toFixed(1)}%
              </span>
            </li>
          );
        })}
        {slices.length === 0 ? (
          <li className="font-mono text-[10px] text-neutral-600">NO HOLDINGS YET</li>
        ) : null}
      </ul>
    </div>
  );
}
