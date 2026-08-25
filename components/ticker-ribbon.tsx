"use client";

import { memo } from "react";
import { HScroll } from "@/components/h-scroll";
import { SignedPct } from "@/components/signed-change";
import { formatPrice } from "@/lib/format";
import type { WatchlistRow } from "@/lib/types";
import { usePriceFlash } from "@/lib/use-price-flash";
import type { TickPulse } from "@/lib/use-market-data";

type TickerRibbonProps = {
  rows: WatchlistRow[];
  ticks: Record<string, TickPulse>;
  onSelect?: (symbol: string) => void;
};

const TAPE_CAP = 24;

function TickerRibbonInner({ rows, ticks, onSelect }: TickerRibbonProps) {
  if (rows.length === 0) return null;

  const visible = rows.slice(0, TAPE_CAP);
  const tape = [...visible, ...visible];

  return (
    <>
      <div className="flex shrink-0 items-center border-b border-line bg-[#0c0c0c] md:hidden">
        <HScroll snap className="min-w-0 flex-1" aria-label="Watchlist tape">
          {visible.map((row) => (
            <RibbonItem key={row.symbol} row={row} ticks={ticks} onSelect={onSelect} snap />
          ))}
        </HScroll>
      </div>
      <div className="hidden shrink-0 items-center overflow-hidden border-b border-line bg-[#0c0c0c] md:flex">
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
    </>
  );
}

function RibbonItem({
  row,
  ticks,
  onSelect,
  snap = false,
}: {
  row: WatchlistRow;
  ticks: Record<string, TickPulse>;
  onSelect?: (symbol: string) => void;
  snap?: boolean;
}) {
  const flash = usePriceFlash(row.symbol, ticks);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.symbol)}
      className={`flex min-h-11 shrink-0 items-baseline gap-1.5 px-3 py-1 font-mono md:min-h-0 ${
        snap ? "snap-start" : ""
      } ${flash}`}
    >
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{row.code}</span>
      <span className="text-[11px] text-neutral-100">{formatPrice(row.quote?.price)}</span>
      <SignedPct value={row.quote?.changePct} className="text-[10px]" />
    </button>
  );
}

export const TickerRibbon = memo(TickerRibbonInner);
