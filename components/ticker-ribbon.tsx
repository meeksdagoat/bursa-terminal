"use client";

import { memo } from "react";
import { HScroll } from "@/components/h-scroll";
import { SignedPct } from "@/components/signed-change";
import { formatPrice } from "@/lib/format";
import { getStockName } from "@/lib/stock-names";
import type { WatchlistRow } from "@/lib/types";
import { usePanXLock } from "@/lib/use-pan-x-lock";
import { usePriceFlash } from "@/lib/use-price-flash";
import type { TickPulse } from "@/lib/use-market-data";

type TickerRibbonProps = {
  rows: WatchlistRow[];
  ticks: Record<string, TickPulse>;
  onSelect?: (symbol: string) => void;
};

const TAPE_CAP = 20;

const TAPE_FRAME =
  "h-10 max-h-10 min-h-10 shrink-0 overflow-x-clip overflow-y-clip select-none touch-pan-x";

function TickerRibbonInner({ rows, ticks, onSelect }: TickerRibbonProps) {
  const setFrame = usePanXLock("[data-ticker-scroller]");

  if (rows.length === 0) return null;

  const visible = rows.slice(0, TAPE_CAP);
  const tape = [...visible, ...visible];

  return (
    <div
      ref={setFrame}
      className={`flex items-center border-b border-line bg-[#0c0c0c] ${TAPE_FRAME}`}
      style={{ touchAction: "pan-x", overscrollBehavior: "none" }}
    >
      <HScroll
        snap
        className="flex h-full min-w-0 flex-1 flex-nowrap items-center overflow-x-auto overflow-y-clip overscroll-none whitespace-nowrap md:hidden"
        aria-label="Market tape"
        data-ticker-scroller=""
      >
        {visible.map((row) => (
          <RibbonItem key={row.symbol} row={row} ticks={ticks} onSelect={onSelect} snap />
        ))}
      </HScroll>

      <div className="hidden h-full min-w-0 flex-1 overflow-x-clip overflow-y-clip md:block">
        <div className="tape-track flex h-full flex-nowrap items-center whitespace-nowrap">
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
      className={`inline-flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-3 font-mono ${
        snap ? "snap-start" : ""
      } ${flash}`}
    >
      <span className="max-w-[8rem] truncate text-[10px] tracking-wide text-neutral-400">
        {getStockName(row.symbol)}
      </span>
      <span className="text-[11px] text-neutral-100">{formatPrice(row.quote?.price)}</span>
      <SignedPct value={row.quote?.changePct} className="text-[10px]" />
    </button>
  );
}

export const TickerRibbon = memo(TickerRibbonInner);
