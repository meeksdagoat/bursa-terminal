"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const shariahOnly = useShariahOnly();
  const saved = useMemo(() => new Set(savedSymbols), [savedSymbols]);
  const results = useMemo(() => {
    const matches = searchUniverse(query);
    return shariahOnly ? matches.filter((entry) => entry.shariah) : matches;
  }, [query, shariahOnly]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 md:items-start md:p-4 md:pt-[8vh]">
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
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-lg border border-line bg-panel shadow-2xl md:max-h-[78vh] md:w-[min(600px,94vw)] md:rounded-none"
      >
        <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-line px-2.5 md:h-8 md:min-h-0">
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

        <div className="shrink-0 border-b border-line p-2">
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

        <ul className="min-h-0 flex-1 divide-y divide-line overflow-auto">
          {results.map((entry) => {
            const isSaved = saved.has(entry.symbol);
            return (
              <li key={entry.symbol} className="flex items-center gap-2 pr-2 hover:bg-[#161616]">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(entry.symbol);
                    onClose();
                  }}
                  title={`Chart ${entry.name}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-left md:min-h-0"
                >
                  <span className="w-[52px] shrink-0 font-mono text-[10px] text-neutral-500">
                    {entry.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-100">
                    {entry.name}
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
                  title={isSaved ? "Remove from watchlist" : "Save to watchlist"}
                  className={`min-h-11 shrink-0 rounded-sm border px-2 font-mono text-[10px] tracking-wider transition-colors md:min-h-0 md:px-1.5 md:py-0.5 md:text-[9px] ${
                    isSaved
                      ? "border-gain/50 bg-gain/10 text-gain hover:border-loss/50 hover:text-loss"
                      : "border-line text-neutral-500 hover:border-gain/40 hover:text-gain"
                  }`}
                >
                  {isSaved ? "★ SAVED" : "☆ SAVE"}
                </button>
              </li>
            );
          })}

          {results.length === 0 ? (
            <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
              NO {shariahOnly ? "SHARIAH-COMPLIANT " : ""}TICKER MATCHES “{query}”
            </li>
          ) : null}
        </ul>

        <div className="flex min-h-11 shrink-0 items-center justify-between border-t border-line px-2.5 font-mono text-[9px] text-neutral-600 pb-[env(safe-area-inset-bottom)] md:h-7 md:min-h-0 md:pb-0">
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
