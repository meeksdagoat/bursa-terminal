"use client";

import {
  memo,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SignedPct } from "@/components/signed-change";
import { Pulse } from "@/components/skeleton";
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
  onReorder: (fromSymbol: string, toSymbol: string) => void;
  onBrowse: () => void;
  onClose?: () => void;
  ticks?: Record<string, TickPulse>;
  loading?: boolean;
};

type DragFloat = {
  row: WatchlistRow;
  width: number;
};

const DRAG_THRESHOLD_PX = 6;

function WatchlistSidebarInner({
  rows,
  sectors,
  selectedSymbol,
  onSelect,
  onRemove,
  onReorder,
  onBrowse,
  onClose,
  ticks = {},
  loading = false,
}: WatchlistSidebarProps) {
  const shariahOnly = useShariahOnly();
  const [draggingSymbol, setDraggingSymbol] = useState<string | null>(null);
  const [dropSymbol, setDropSymbol] = useState<string | null>(null);
  const [floatCard, setFloatCard] = useState<DragFloat | null>(null);
  const dragFromRef = useRef<string | null>(null);
  const dropToRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const floatRef = useRef<HTMLDivElement | null>(null);

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
  const draggingRow = floatCard?.row ?? null;

  function placeFloat(x: number, y: number) {
    const node = floatRef.current;
    if (!node) return;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

  function handleSelect(symbol: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(symbol);
  }

  function handlePointerDown(symbol: string, event: ReactPointerEvent<HTMLLIElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-remove]")) return;

    const rowEl = event.currentTarget;
    const pointerId = event.pointerId;
    const startY = event.clientY;
    let active = false;

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;

      if (!active) {
        if (Math.abs(ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        active = true;
        dragFromRef.current = symbol;
        dropToRef.current = null;
        setDraggingSymbol(symbol);
        setDropSymbol(null);

        const row = visibleRows.find((entry) => entry.symbol === symbol);
        if (row) {
          const rect = rowEl.getBoundingClientRect();
          setFloatCard({ row, width: rect.width });
          // Position on next frame once the float node mounts.
          requestAnimationFrame(() => placeFloat(ev.clientX, ev.clientY));
        }

        try {
          rowEl.setPointerCapture(pointerId);
        } catch {
          // Capture unavailable — continue with window listeners.
        }
      }

      ev.preventDefault();
      placeFloat(ev.clientX, ev.clientY);

      // Ignore the floating card under the cursor when resolving drop targets.
      const floatNode = floatRef.current;
      if (floatNode) floatNode.style.pointerEvents = "none";
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (floatNode) floatNode.style.pointerEvents = "none";

      const target = under?.closest<HTMLElement>("[data-watchlist-symbol]");
      const overSymbol = target?.dataset.watchlistSymbol ?? null;
      if (!overSymbol || overSymbol === dragFromRef.current) {
        dropToRef.current = null;
        setDropSymbol(null);
        return;
      }
      dropToRef.current = overSymbol;
      setDropSymbol(overSymbol);
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      try {
        if (rowEl.hasPointerCapture(pointerId)) {
          rowEl.releasePointerCapture(pointerId);
        }
      } catch {
        // Already released.
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      const from = dragFromRef.current;
      const to = dropToRef.current;
      dragFromRef.current = null;
      dropToRef.current = null;
      setDraggingSymbol(null);
      setDropSymbol(null);
      setFloatCard(null);

      if (active && from && to && from !== to) {
        suppressClickRef.current = true;
        onReorder(from, to);
      }
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <aside className="relative flex h-full min-h-0 flex-col overflow-hidden bg-panel">
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[11px] text-neutral-500 hover:text-gain lg:hidden"
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

      <ul className="custom-scrollbar min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain touch-pan-y">
        {loading
          ? Array.from({ length: 8 }, (_, index) => (
              <li key={index} className="flex items-center gap-3 px-2.5 py-2.5" aria-hidden>
                <div className="min-w-0 flex-1">
                  <Pulse className="h-3 w-[70%]" />
                  <Pulse className="mt-1.5 h-2.5 w-[40%]" />
                </div>
                <Pulse className="h-3 w-12" />
              </li>
            ))
          : visibleRows.map((row) => {
          const active = row.symbol === selectedSymbol;
          return (
            <WatchlistRowItem
              key={row.symbol}
              row={row}
              active={active}
              dragging={draggingSymbol === row.symbol}
              dropTarget={dropSymbol === row.symbol}
              ticks={ticks}
              onSelect={handleSelect}
              onRemove={onRemove}
              onPointerDown={handlePointerDown}
            />
          );
        })}

        {!loading && visibleRows.length === 0 ? (
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

      <ul className="custom-scrollbar max-h-[40%] min-h-0 shrink-0 divide-y divide-line overflow-y-auto overscroll-contain touch-pan-y">
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

      {draggingRow && floatCard ? (
        <div
          ref={floatRef}
          aria-hidden
          className="watchlist-drag-float pointer-events-none fixed z-[70] rounded-sm border border-gain/40 bg-[#141414]/95 backdrop-blur-sm"
          style={{ width: floatCard.width, left: 0, top: 0 }}
        >
          <DragFloatBody row={draggingRow} ticks={ticks} />
        </div>
      ) : null}
    </aside>
  );
}

function DragFloatBody({
  row,
  ticks,
}: {
  row: WatchlistRow;
  ticks: Record<string, TickPulse>;
}) {
  const flash = usePriceFlash(row.symbol, ticks);

  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <span className="h-6 w-0.5 shrink-0 bg-gain" />
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
    </div>
  );
}

function WatchlistRowItem({
  row,
  active,
  dragging,
  dropTarget,
  ticks,
  onSelect,
  onRemove,
  onPointerDown,
}: {
  row: WatchlistRow;
  active: boolean;
  dragging: boolean;
  dropTarget: boolean;
  ticks: Record<string, TickPulse>;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onPointerDown: (symbol: string, event: ReactPointerEvent<HTMLLIElement>) => void;
}) {
  const flash = usePriceFlash(row.symbol, ticks);

  return (
    <li
      data-watchlist-symbol={row.symbol}
      onPointerDown={(event) => onPointerDown(row.symbol, event)}
      className={`group flex cursor-grab items-stretch select-none transition-[opacity,transform,box-shadow] duration-150 active:cursor-grabbing ${
        active ? "bg-[#1a1a1a]" : "hover:bg-[#161616]"
      } ${
        dragging
          ? "scale-[0.98] opacity-30 shadow-[inset_0_0_0_1px_rgb(16_185_129_/_0.25)]"
          : ""
      } ${dropTarget ? "border-t-2 border-t-gain bg-gain/5" : ""}`}
      title="Hold and drag to reorder"
    >
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
        data-remove=""
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
