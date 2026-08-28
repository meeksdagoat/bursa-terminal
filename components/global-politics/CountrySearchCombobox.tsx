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
  countryStatusDotClass,
  formatStoryCount,
  searchCountries,
  type CountrySearchResult,
} from "@/lib/geopolitics/country-search";
import { displayCountryName } from "@/lib/geopolitics/world-registry";
import type { GeopoliticsMapModel } from "@/lib/geopolitics/types";

type CountrySearchComboboxProps = {
  model: GeopoliticsMapModel;
  selectedIso2: string | null;
  onSelectCountry: (iso2: string) => void;
};

export function CountrySearchCombobox({
  model,
  selectedIso2,
  onSelectCountry,
}: CountrySearchComboboxProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const { results, totalMatches } = useMemo(
    () => searchCountries(query, model),
    [model, query],
  );

  const showMenu = open;
  const active = results[activeIndex] ?? null;

  useEffect(() => {
    if (open) return;
    setQuery(selectedIso2 ? displayCountryName(selectedIso2) : "");
  }, [open, selectedIso2]);

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

  function pick(result: CountrySearchResult) {
    onSelectCountry(result.iso2);
    setQuery(result.name);
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
      setQuery(selectedIso2 ? displayCountryName(selectedIso2) : "");
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

    if (event.key === "Enter" && active) {
      event.preventDefault();
      pick(active);
    }
  }

  const matchHeader =
    query.trim().length === 0
      ? `Browse ${Math.min(results.length, totalMatches)} countries`
      : totalMatches > results.length
        ? `${totalMatches} matches · showing ${results.length}`
        : `${totalMatches} match${totalMatches === 1 ? "" : "es"}`;

  return (
    <div
      ref={wrapRef}
      className="absolute left-4 top-4 z-20 w-64 md:w-80"
    >
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search country
      </label>
      <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-[#121212]/90 px-3 py-1.5 shadow-2xl backdrop-blur-md transition-all focus-within:border-amber-500/80">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5 shrink-0 text-neutral-500"
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
          aria-activedescendant={showMenu && active ? `${listId}-${active.iso2}` : undefined}
          value={query}
          placeholder="Search country (e.g. Japan, Sudan)..."
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-200 outline-none placeholder:text-neutral-600"
        />

        {query.length > 0 ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearQuery}
            className="shrink-0 rounded p-0.5 text-neutral-500 transition-colors hover:text-zinc-200"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {showMenu ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-full overflow-hidden rounded-md border border-neutral-800 bg-[#141414]/95 shadow-2xl backdrop-blur-md">
          <p className="border-b border-neutral-900/50 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
            {matchHeader}
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-label="Countries"
            className="max-h-60 divide-y divide-neutral-900/50 overflow-y-auto overscroll-contain"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2.5 font-mono text-[10px] text-neutral-600">No matching countries</li>
            ) : (
              results.map((result, index) => {
                const isActive = index === activeIndex;
                const isSelected = result.iso2 === selectedIso2;

                return (
                  <li key={result.iso2} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${result.iso2}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(result)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        isActive ? "bg-neutral-800/60" : "hover:bg-neutral-800/40"
                      } ${isSelected ? "border-l-2 border-amber-400/70" : "border-l-2 border-transparent"}`}
                    >
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${countryStatusDotClass(result)}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                        <Highlight text={result.name} query={query} />
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-neutral-500">
                        {formatStoryCount(result.articleCount)}
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
