/** Pulsing placeholders sized to the terminal's news cards, table rows, and KPIs. */

export function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-zinc-800/60 ${className}`} />;
}

export function CountPulse() {
  return <Pulse className="h-2.5 w-7" />;
}

export function NewsCardSkeleton() {
  return (
    <li className="flex flex-col gap-2 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <Pulse className="h-3 w-14" />
        <Pulse className="h-3 w-10" />
      </div>
      <Pulse className="h-4 w-[94%]" />
      <Pulse className="h-4 w-[68%]" />
      <Pulse className="h-2.5 w-28" />
    </li>
  );
}

export function NewsFeedSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-line" aria-busy="true" aria-label="Loading headlines">
      {Array.from({ length: rows }, (_, index) => (
        <NewsCardSkeleton key={index} />
      ))}
    </ul>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-3" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-2">
          {Array.from({ length: cols }, (_, col) => (
            <Pulse
              key={col}
              className={`h-7 ${col === 0 ? "w-[28%]" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="bg-panel px-3 py-3" aria-hidden>
      <Pulse className="h-2.5 w-24" />
      <Pulse className="mt-2 h-5 w-28" />
      <Pulse className="mt-1.5 h-2.5 w-16" />
    </div>
  );
}

export function SparklineSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-1" aria-busy="true" aria-label="Loading history">
      <Pulse className="h-9 w-full" />
      <div className="flex justify-between gap-2">
        <Pulse className="h-2.5 w-20" />
        <Pulse className="h-2.5 w-20" />
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 px-2.5 py-3" aria-busy="true" aria-label="Loading panel">
      {Array.from({ length: rows }, (_, index) => (
        <Pulse key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function FinancialGridSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className="min-h-[280px] overflow-hidden border-t border-line"
      aria-busy="true"
      aria-label="Loading financial statements"
    >
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        <Pulse className="h-3 w-28" />
        {Array.from({ length: cols }, (_, col) => (
          <Pulse key={col} className="ml-auto h-3 w-14" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-2 border-b border-line/60 px-2.5 py-2">
          <Pulse className={`h-3.5 ${row % 3 === 0 ? "w-32" : "w-24"}`} />
          {Array.from({ length: cols }, (_, col) => (
            <div key={col} className="ml-auto flex w-16 flex-col items-end gap-1">
              <Pulse className="h-3 w-12" />
              <Pulse className="h-2 w-8" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EventRowSkeleton() {
  return (
    <li className="flex flex-col gap-2 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Pulse className="h-3 w-16" />
        <Pulse className="h-3 w-14" />
        <Pulse className="h-3 w-12" />
      </div>
      <Pulse className="h-4 w-[92%]" />
      <Pulse className="h-4 w-[60%]" />
    </li>
  );
}

export function EventTimelineSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-line" aria-busy="true" aria-label="Loading events">
      {Array.from({ length: rows }, (_, index) => (
        <EventRowSkeleton key={index} />
      ))}
    </ul>
  );
}

export function MoverRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Pulse className="h-3 w-3" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Pulse className="h-3.5 w-[70%]" />
        <Pulse className="h-2.5 w-[40%]" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Pulse className="h-3.5 w-14" />
        <Pulse className="h-4 w-12 rounded-full" />
      </div>
    </li>
  );
}
