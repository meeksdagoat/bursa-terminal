"use client";

import { changeClass, formatPct, formatPrice } from "@/lib/format";
import type { WatchlistRow } from "@/lib/types";
import { usePriceFlash } from "@/lib/use-price-flash";
import type { TickPulse } from "@/lib/use-market-data";

type TickerRibbonProps = {
  rows: WatchlistRow[];
  ticks: Record<string, TickPulse>;
  onSelect?: (symbol: string) => void;
};

export function TickerRibbon({ rows, ticks, onSelect }: TickerRibbonProps) {
  if (rows.length === 0) return null;

  const tape = [...rows, ...rows];

  return (
    <div className="flex shrink-0 items-center overflow-hidden border-b border-line bg-[#0c0c0c]">
      <span className="hidden shrink-0 border-r border-line px-2 font-mono text-[9px] uppercase tracking-[0.16em] text-gain sm:inline">
        TAPE
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="tape-track flex">
          {tape.map((row, index) => (
            <RibbonItem
              key={`${row.symbol}-${index}`}
              row={row}
              ticks={ticks}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RibbonItem({
  row,
  ticks,
  onSelect,
}: {
  row: WatchlistRow;
  ticks: Record<string, TickPulse>;
  onSelect?: (symbol: string) => void;
}) {
  const flash = usePriceFlash(row.symbol, ticks);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.symbol)}
      className={`flex shrink-0 items-baseline gap-1.5 px-3 py-1 font-mono ${flash}`}
    >
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{row.code}</span>
      <span className="text-[11px] text-neutral-100">{formatPrice(row.quote?.price)}</span>
      <span className={`text-[10px] ${changeClass(row.quote?.changePct)}`}>
        {formatPct(row.quote?.changePct)}
      </span>
    </button>
  );
}
