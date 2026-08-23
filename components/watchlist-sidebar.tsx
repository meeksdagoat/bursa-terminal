"use client";

import { changeClass, formatPct, formatPrice } from "@/lib/format";
import type { SectorPerformance, WatchlistRow } from "@/lib/types";

type WatchlistSidebarProps = {
  rows: WatchlistRow[];
  sectors: SectorPerformance[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
};

export function WatchlistSidebar({
  rows,
  sectors,
  selectedSymbol,
  onSelect,
}: WatchlistSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-panel">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-line px-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Watchlist
        </h2>
        <span className="font-mono text-[9px] text-neutral-600">MY · MAIN</span>
      </div>

      <ul className="shrink-0 divide-y divide-line">
        {rows.map((row) => {
          const active = row.symbol === selectedSymbol;
          return (
            <li key={row.symbol}>
              <button
                type="button"
                onClick={() => onSelect(row.symbol)}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                  active ? "bg-[#1a1a1a]" : "hover:bg-[#161616]"
                }`}
              >
                <span
                  className={`h-6 w-0.5 shrink-0 ${active ? "bg-gain" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-neutral-100">
                      {row.name}
                    </span>
                    <span className="font-mono text-[11px] text-neutral-200">
                      {formatPrice(row.quote?.price)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[9px] text-neutral-500">{row.symbol}</span>
                    <span
                      className={`font-mono text-[10px] ${changeClass(row.quote?.changePct)}`}
                    >
                      {formatPct(row.quote?.changePct)}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 flex h-7 shrink-0 items-center justify-between border-y border-line px-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Sectors
        </h2>
        <span className="font-mono text-[9px] text-neutral-600">WATCHLIST AVG</span>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-line overflow-auto">
        {sectors.map((sector) => (
          <li key={sector.name} className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] text-neutral-300">{sector.name}</span>
            <span className={`font-mono text-[10px] ${changeClass(sector.changePct)}`}>
              {formatPct(sector.changePct)}
            </span>
          </li>
        ))}
        {sectors.length === 0 ? (
          <li className="px-2.5 py-2 font-mono text-[10px] text-neutral-600">NO DATA</li>
        ) : null}
      </ul>
    </aside>
  );
}
