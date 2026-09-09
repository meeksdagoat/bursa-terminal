"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  QUANT_ASSET_FILTER_PILLS,
  formatQuantAssetLabel,
  getQuantAssetCount,
  searchQuantAssets,
  type QuantAssetFilter,
} from "@/constants/quantAssets";
import { getUsTickerCount } from "@/constants/usTickers";
import { categoryBadge, resolveQuantAsset, type QuantAsset } from "@/lib/quant/asset-catalog";

const ACTIVE_PILL =
  "border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400 transition-all rounded-md";
const IDLE_PILL =
  "rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-xs text-neutral-400 transition-all hover:text-white";

const RESULT_LIMIT = 40;

export type QuantAssetSelectorProps = {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
};

export function QuantAssetSelector({
  value,
  onChange,
  className = "",
}: QuantAssetSelectorProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => resolveQuantAsset(value), [value]);
  const selectedLabel = selected ? formatQuantAssetLabel(selected) : value;

  const [filter, setFilter] = useState<QuantAssetFilter>("bursa");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const { results, totalMatches } = useMemo(
    () => searchQuantAssets(query, filter, RESULT_LIMIT),
    [query, filter],
  );

  const active = results[activeIndex] ?? null;
  const showMenu = open;

  useEffect(() => {
    if (open) return;
    setQuery(selectedLabel);
  }, [open, selectedLabel]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter]);

  useEffect(() => {
    if (!showMenu) return;

    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
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

  function pick(asset: QuantAsset) {
    onChange(asset.symbol);
    setQuery(formatQuantAssetLabel(asset));
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearQuery() {
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(selectedLabel);
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
      pick(active);
    }
  }

  const matchHeader =
    query.trim().length === 0
      ? `Showing ${Math.min(RESULT_LIMIT, totalMatches)} of ${totalMatches.toLocaleString()} assets`
      : totalMatches > RESULT_LIMIT
        ? `Showing ${RESULT_LIMIT} of ${totalMatches.toLocaleString()} matches`
        : `${totalMatches.toLocaleString()} match${totalMatches === 1 ? "" : "es"}`;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-1.5">
        {QUANT_ASSET_FILTER_PILLS.map((pill) => {
          const activeFilter = filter === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                setFilter(pill.id);
                setOpen(true);
              }}
              className={activeFilter ? ACTIVE_PILL : IDLE_PILL}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      <div className="relative min-w-0" ref={wrapRef}>
        <label className="sr-only" htmlFor={`${listId}-input`}>
          Search quant assets
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500"
          >
            🔍
          </span>
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
            placeholder={`Search ${getQuantAssetCount().toLocaleString()}+ tickers (${getUsTickerCount().toLocaleString()} US) — e.g. AAPL, NVDA, Maybank, Gold…`}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery("");
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className="min-h-[44px] w-full rounded-md border border-neutral-800 bg-[#121212] py-2 pl-9 pr-9 font-mono text-base text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none md:min-h-0 md:text-sm"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearQuery}
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded font-mono text-sm text-neutral-500 hover:text-white"
            >
              ×
            </button>
          ) : null}
        </div>

        {showMenu ? (
          <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-neutral-800 bg-[#141414] shadow-2xl">
            <p className="border-b border-neutral-800 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
              {matchHeader}
            </p>
            <ul
              id={listId}
              role="listbox"
              aria-label="Quant assets"
              className="max-h-60 overflow-y-auto overscroll-contain"
            >
              {results.length === 0 ? (
                <li className="px-2.5 py-2 font-mono text-[10px] text-neutral-600">NO MATCHING ASSETS</li>
              ) : (
                results.map((asset, index) => {
                  const isSelected = index === activeIndex;
                  const isCurrent = asset.symbol === value;
                  const badge = categoryBadge(asset.category);

                  return (
                    <li key={asset.symbol} role="presentation">
                      <button
                        type="button"
                        id={`${listId}-${asset.symbol}`}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(asset)}
                        className={`flex min-h-10 w-full items-center gap-2 px-2.5 py-2 text-left transition-colors ${
                          isSelected ? "bg-neutral-800/60" : "hover:bg-neutral-800/60"
                        } ${isCurrent ? "border-l-2 border-emerald-500/70" : "border-l-2 border-transparent"}`}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-200">
                          {formatQuantAssetLabel(asset)}
                        </span>
                        {asset.category === "global" && asset.sector !== "Index" ? (
                          <span className="shrink-0 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                            {asset.sector}
                          </span>
                        ) : null}
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] ${badge.className}`}
                        >
                          [{badge.label}]
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {selected ? <AssetMeta asset={selected} /> : null}
    </div>
  );
}

function CategoryBadge({ asset }: { asset: QuantAsset }) {
  const badge = categoryBadge(asset.category);
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.14em] ${badge.className}`}
    >
      [{badge.label}]
    </span>
  );
}

function AssetMeta({ asset }: { asset: QuantAsset }) {
  return (
    <p className="text-[10px] text-neutral-600">
      {asset.label} · {asset.sector} · {asset.currency}
    </p>
  );
}

export function AssetCategoryBadge({ symbol }: { symbol: string }) {
  const asset = resolveQuantAsset(symbol);
  if (!asset) return null;
  return <CategoryBadge asset={asset} />;
}

/** @deprecated Use QuantAssetSelector */
export const AssetSelector = QuantAssetSelector;
