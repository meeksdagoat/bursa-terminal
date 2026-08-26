"use client";

import { useEffect, useMemo, useState } from "react";
import { VirtualList } from "@/components/virtual-list";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { searchUniverse, universe } from "@/lib/universe";
import { useShariahOnly } from "@/lib/use-shariah";

type StockPickerProps = {
  onClose: () => void;
  savedSymbols: string[];
  onToggleSave: (symbol: string) => void;
  onSelect: (symbol: string) => void;
  onReset: () => void;
};

/** Mounted only while open, so the query resets naturally on each open. */
export function StockPicker({
  onClose,
  savedSymbols,
  onToggleSave,
  onSelect,
  onReset,
}: StockPickerProps) {
  const [query, setQuery] = useState("");
  useBodyScrollLock(true);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const shariahOnly = useShariahOnly();
  const saved = useMemo(() => new Set(savedSymbols), [savedSymbols]);
  const results = useMemo(() => {
    const matches = searchUniverse(query, universe.length);
    return shariahOnly ? matches.filter((entry) => entry.shariah) : matches;
  }, [query, shariahOnly]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      data-modal-open=""
    >
      <button
        type="button"
        aria-label="Close ticker browser"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bursa Malaysia ticker browser"
        className="relative z-10 flex max-h-[85vh] w-full min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-[#0d0d0d] shadow-2xl md:w-[min(600px,94vw)]"
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-neutral-800 bg-[#0d0d0d] p-4">
          <div className="mb-3 flex min-h-11 items-center justify-between md:min-h-0">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
              Bursa Universe
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-neutral-600">
                {saved.size} SAVED ·{" "}
                {shariahOnly ? `${results.length} SHARIAH` : `${universe.length} TICKERS`}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center px-2 font-mono text-[11px] text-neutral-500 hover:text-gain md:min-h-0 md:text-[10px]"
              >
                CLOSE
              </button>
            </div>
          </div>
          <label className="sr-only" htmlFor="universe-search">
            Search the Bursa universe
          </label>
          <input
            id="universe-search"
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, code or sector — maybank / 1155 / banking"
            className="h-11 w-full rounded-sm border border-line bg-[#0a0a0a] px-2.5 font-mono text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-gain/50 md:h-8 md:text-[11px]"
          />
        </div>

        <div className="modal-ticker-scroll flex min-h-0 flex-1 flex-col divide-y divide-neutral-800/50 overflow-y-auto overscroll-contain">
          {results.length === 0 ? (
            <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
              NO {shariahOnly ? "SHARIAH-COMPLIANT " : ""}TICKER MATCHES “{query}”
            </p>
          ) : (
            <VirtualList
              count={results.length}
              itemHeight={52}
              className="modal-ticker-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
              renderItem={(index) => {
                const entry = results[index];
                const isSaved = saved.has(entry.symbol);
                return (
                  <div key={entry.symbol} className="flex h-[52px] items-center gap-2 pr-2 hover:bg-[#161616]">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(entry.symbol);
                        onClose();
                      }}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2.5 text-left md:min-h-0"
                    >
                      <span className="w-[52px] shrink-0 font-mono text-[10px] text-neutral-500">
                        {entry.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-100">
                        {entry.name}
                        <span className="ml-1.5 font-mono text-[9px] text-neutral-600">
                          {entry.shortName}
                        </span>
                      </span>
                      <span className="hidden w-[36px] shrink-0 font-mono text-[9px] text-neutral-500 sm:block">
                        {entry.market}
                      </span>
                      <span className="hidden w-[86px] shrink-0 truncate text-[10px] text-neutral-500 sm:block">
                        {entry.sector}
                      </span>
                      <span
                        className={`w-[38px] shrink-0 text-right font-mono text-[9px] ${
                          entry.shariah ? "text-gain/70" : "text-neutral-700"
                        }`}
                      >
                        {entry.shariah ? "SHRH" : "—"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleSave(entry.symbol)}
                      aria-pressed={isSaved}
                      className={`min-h-11 shrink-0 rounded-sm border px-2 font-mono text-[10px] tracking-wider transition-colors md:min-h-0 md:px-1.5 md:py-0.5 md:text-[9px] ${
                        isSaved
                          ? "border-gain/50 bg-gain/10 text-gain hover:border-loss/50 hover:text-loss"
                          : "border-line text-neutral-500 hover:border-gain/40 hover:text-gain"
                      }`}
                    >
                      {isSaved ? "★ SAVED" : "☆ SAVE"}
                    </button>
                  </div>
                );
              }}
            />
          )}
        </div>

        <div className="z-10 flex min-h-11 flex-shrink-0 items-center justify-between border-t border-neutral-800 bg-[#0d0d0d] p-3 font-mono text-[9px] text-neutral-600 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:min-h-0">
          <span className="hidden sm:inline">CLICK A ROW TO CHART · SAVE TO PIN IT TO THE WATCHLIST</span>
          <span className="sm:hidden">TAP A ROW TO CHART</span>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 px-2 text-neutral-500 hover:text-amber-400 md:min-h-0"
          >
            RESET DEFAULTS
          </button>
        </div>
      </div>
    </div>
  );
}
