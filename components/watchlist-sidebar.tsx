"use client";

import { memo, useMemo } from "react";
import { SignedPct } from "@/components/signed-change";
import { formatPrice } from "@/lib/format";
import { sectorPerformance } from "@/lib/sectors";
import type { SectorPerformance, WatchlistRow } from "@/lib/types";
import type { TickPulse } from "@/lib/use-market-data";
import { usePriceFlash } from "@/lib/use-price-flash";
import { useShariahOnly } from "@/lib/use-shariah";

type WatchlistSidebarProps = {
  rows: WatchlistRow[];
  sectors: SectorPerformance[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onBrowse: () => void;
  onClose?: () => void;
  ticks?: Record<string, TickPulse>;
};

function WatchlistSidebarInner({
  rows,
  sectors,
  selectedSymbol,
  onSelect,
  onRemove,
  onBrowse,
  onClose,
  ticks = {},
}: WatchlistSidebarProps) {
  const shariahOnly = useShariahOnly();

  const visibleRows = useMemo(
    () => (shariahOnly ? rows.filter((row) => row.shariah) : rows),
    [rows, shariahOnly],
  );

  // Sector averages are rebuilt from the visible names, so the table never
  // reports a move that includes a stock the filter has hidden.
  const visibleSectors = useMemo(
    () =>
      shariahOnly
        ? sectorPerformance(
            visibleRows.map((row) => ({
              sector: row.sector,
              changePct: row.quote?.changePct ?? null,
            })),
          )
        : sectors,
    [shariahOnly, visibleRows, sectors],
  );

  const hidden = rows.length - visibleRows.length;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-line px-2.5 md:h-7 md:min-h-0">
        <h2
          id="watchlist-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90"
        >
          Watchlist
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBrowse}
            title="Browse and search all Bursa tickers"
            className="min-h-11 rounded-sm border border-line px-3 font-mono text-[10px] tracking-wider text-neutral-500 hover:border-gain/40 hover:text-gain md:min-h-0 md:px-1.5 md:text-[9px]"
          >
            + ADD
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close watchlist"
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[11px] text-neutral-500 hover:text-gain sm:hidden"
            >
              CLOSE
            </button>
          ) : null}
        </div>
      </div>

      {hidden > 0 ? (
        <p className="shrink-0 border-b border-line bg-[#0d120d] px-2.5 py-1 font-mono text-[9px] text-gain/80">
          SHARIAH ONLY · {hidden} HIDDEN
        </p>
      ) : null}

      <ul className="custom-scrollbar min-h-0 max-h-[55%] shrink-0 divide-y divide-line overflow-y-auto">
        {visibleRows.map((row) => {
          const active = row.symbol === selectedSymbol;
          return (
            <WatchlistRowItem
              key={row.symbol}
              row={row}
              active={active}
              ticks={ticks}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          );
        })}

        {visibleRows.length === 0 ? (
          <li className="px-2.5 py-3">
            <p className="font-mono text-[10px] leading-relaxed text-neutral-600">
              {rows.length > 0 ? "NO SHARIAH-COMPLIANT NAMES SAVED" : "WATCHLIST EMPTY"}
            </p>
            <button
              type="button"
              onClick={onBrowse}
              className="mt-1 font-mono text-[10px] text-gain hover:underline"
            >
              BROWSE TICKERS →
            </button>
          </li>
        ) : null}
      </ul>

      <div className="mt-1 flex min-h-11 shrink-0 items-center justify-between border-y border-line px-2.5 md:h-7 md:min-h-0">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Sectors
        </h2>
        <span className="font-mono text-[9px] text-neutral-600">
          {shariahOnly ? "SHARIAH AVG" : "WATCHLIST AVG"}
        </span>
      </div>

      <ul className="custom-scrollbar min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {visibleSectors.map((sector) => (
          <li key={sector.name} className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] text-neutral-300">{sector.name}</span>
            <SignedPct value={sector.changePct} className="font-mono text-[10px]" />
          </li>
        ))}
        {visibleSectors.length === 0 ? (
          <li className="px-2.5 py-2 font-mono text-[10px] text-neutral-600">NO DATA</li>
        ) : null}
      </ul>
    </aside>
  );
}

function WatchlistRowItem({
  row,
  active,
  ticks,
  onSelect,
  onRemove,
}: {
  row: WatchlistRow;
  active: boolean;
  ticks: Record<string, TickPulse>;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  const flash = usePriceFlash(row.symbol, ticks);

  return (
    <li className={`group flex items-stretch ${active ? "bg-[#1a1a1a]" : "hover:bg-[#161616]"}`}>
      <button
        type="button"
        onClick={() => onSelect(row.symbol)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 text-left transition-colors md:min-h-0"
      >
        <span className={`h-6 w-0.5 shrink-0 ${active ? "bg-gain" : "bg-transparent"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[12px] font-medium text-neutral-100">{row.name}</span>
            <span className={`rounded-sm px-1 font-mono text-[11px] text-neutral-200 ${flash}`}>
              {formatPrice(row.quote?.price)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[9px] text-neutral-500">{row.symbol}</span>
            <SignedPct value={row.quote?.changePct} className="font-mono text-[10px]" />
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onRemove(row.symbol)}
        title={`Remove ${row.name} from watchlist`}
        aria-label={`Remove ${row.name} from watchlist`}
        className="w-11 shrink-0 font-mono text-[14px] text-neutral-500 opacity-100 transition-opacity hover:text-loss md:w-5 md:text-[11px] md:text-neutral-700 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

export const WatchlistSidebar = memo(WatchlistSidebarInner);
