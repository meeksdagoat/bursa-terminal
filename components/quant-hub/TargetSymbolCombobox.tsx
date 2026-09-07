"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { formatStockOptionLabel, getStockCode, getStockName } from "@/lib/stock-names";
import type { QuantSymbolOption } from "@/lib/quant/types";
import { entryBySymbol, searchUniverseResults, universe } from "@/lib/universe";

export type SelectedTargetSymbol = QuantSymbolOption & {
  name: string;
  code: string;
};

type TargetSymbolComboboxProps = {
  value: string;
  onChange: (symbol: string) => void;
  compact?: boolean;
  placeholder?: string;
};

const DROPDOWN_RENDER_LIMIT = 20;

export function resolveSelectedTargetSymbol(symbol: string): SelectedTargetSymbol {
  const entry = entryBySymbol(symbol);
  return {
    symbol,
    label: formatStockOptionLabel(symbol),
    sector: entry?.sector ?? "—",
    name: getStockName(symbol),
    code: getStockCode(symbol),
  };
}

export function TargetSymbolCombobox({
  value,
  onChange,
  compact = false,
  placeholder = "Search name or code — Maybank, 1155",
}: TargetSymbolComboboxProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => resolveSelectedTargetSymbol(value), [value]);

  const [query, setQuery] = useState(selected.name);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const { results, totalMatches } = useMemo(
    () => searchUniverseResults(query, DROPDOWN_RENDER_LIMIT),
    [query],
  );

  const showMenu = open;
  const active = results[activeIndex] ?? null;

  useEffect(() => {
    if (!open) setQuery(selected.name);
  }, [selected.name, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!showMenu) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const option = wrapRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, showMenu]);

  function pick(symbol: string) {
    onChange(symbol);
    setQuery(getStockName(symbol));
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (!showMenu) return;
      event.preventDefault();
      setOpen(false);
      setQuery(selected.name);
      return;
    }

    if (event.key === "ArrowDown") {
      if (results.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
      return;
    }

    if (event.key === "Enter" && showMenu && active) {
      event.preventDefault();
      pick(active.symbol);
    }
  }

  const matchHeader =
    query.trim().length === 0
      ? `Showing ${Math.min(DROPDOWN_RENDER_LIMIT, universe.length)} of ${universe.length} tickers`
      : totalMatches > DROPDOWN_RENDER_LIMIT
        ? `Showing ${DROPDOWN_RENDER_LIMIT} of ${totalMatches} matches`
        : `${totalMatches} match${totalMatches === 1 ? "" : "es"}`;

  return (
    <div className="relative min-w-0" ref={wrapRef}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Target Symbol B
      </label>
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-activedescendant={showMenu && active ? `${listId}-${active.symbol}` : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`min-h-[44px] w-full rounded border border-neutral-800 bg-[#0d0d0d] pl-8 pr-2.5 font-mono text-base text-zinc-200 outline-none placeholder:text-neutral-600 focus:border-amber-400/40 md:min-h-0 md:text-sm ${
            compact ? "py-1.5" : "py-2"
          }`}
        />
      </div>

      {showMenu ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-neutral-800 bg-[#141414] shadow-2xl">
          <p className="border-b border-neutral-800 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
            {matchHeader}
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-label="Target symbols"
            className="max-h-64 overflow-y-auto overscroll-contain"
          >
            {results.length === 0 ? (
              <li className="px-2.5 py-2 font-mono text-[10px] text-neutral-600">NO MATCHING TICKERS</li>
            ) : (
              results.map((entry, index) => {
                const name = getStockName(entry.symbol);
                const code = getStockCode(entry.symbol);
                const isSelected = index === activeIndex;
                const isCurrent = entry.symbol === value;

                return (
                  <li key={entry.symbol} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${entry.symbol}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(entry.symbol)}
                      className={`flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left transition-colors ${
                        isSelected ? "bg-neutral-800/60" : "hover:bg-neutral-800/60"
                      } ${isCurrent ? "border-l-2 border-amber-400/70" : "border-l-2 border-transparent"}`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                        <Highlight text={name} query={query} />
                        <span className="text-neutral-500"> (</span>
                        <Highlight text={code} query={query} />
                        <span className="text-neutral-500">)</span>
                      </span>
                      <span className="shrink-0 rounded border border-neutral-800 bg-[#0d0d0d] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-neutral-500">
                        {entry.sector}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-1 text-[10px] text-neutral-600">
          {selected.name} · {selected.sector}
        </p>
      ) : null}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const lower = text.toLowerCase();
  const match = needle.toLowerCase();
  const index = lower.indexOf(match);
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-amber-400/20 text-amber-400">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}
