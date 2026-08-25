"use client";

import {
  KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { UniverseEntry } from "@/lib/types";
import { searchUniverse } from "@/lib/universe";
import { useShariahOnly } from "@/lib/use-shariah";

const RESULT_LIMIT = 12;

type TickerSearchFieldProps = {
  id: string;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  mobile?: boolean;
  onSearch: (query: string) => void;
  onPicked?: () => void;
};

export function TickerSearchField({
  id,
  placeholder,
  inputRef,
  mobile = false,
  onSearch,
  onPicked,
}: TickerSearchFieldProps) {
  const listId = useId();
  const shariahOnly = useShariahOnly();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  const results = useMemo(() => {
    const needle = query.trim();
    if (!needle) return [];
    const matches = searchUniverse(needle, RESULT_LIMIT);
    return shariahOnly ? matches.filter((entry) => entry.shariah) : matches;
  }, [query, shariahOnly]);

  const showMenu = open && query.trim().length > 0;
  const active = results[activeIndex] ?? null;

  function assignRef(node: HTMLInputElement | null) {
    localInputRef.current = node;
    if (!inputRef) return;
    if (typeof inputRef === "object") inputRef.current = node;
  }

  function pick(entry: UniverseEntry) {
    setQuery(entry.code);
    setOpen(false);
    onSearch(entry.symbol);
    onPicked?.();
  }

  function updateBox() {
    const el = wrapRef.current;
    if (!el) return;
    setBox(el.getBoundingClientRect());
  }

  useLayoutEffect(() => {
    if (!showMenu) return;
    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [showMenu, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, shariahOnly]);

  useEffect(() => {
    const form = localInputRef.current?.form;
    if (!form) return;
    function onSubmit() {
      setOpen(false);
    }
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const option = menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, showMenu]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (!showMenu) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
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

  const menuWidth = box ? Math.min(Math.max(box.width, mobile ? box.width : 280), window.innerWidth - 16) : 0;
  const menuLeft = box ? Math.min(Math.max(8, box.left), window.innerWidth - menuWidth - 8) : 0;

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Search tickers
      </label>
      <div className="relative min-w-0 flex-1" ref={wrapRef}>
        <input
          ref={assignRef}
          id={id}
          name="ticker"
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
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`h-11 w-full rounded-sm border border-neutral-800 bg-[#0a0a0a] px-2.5 font-mono text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-gain/50 md:h-7 md:text-[11px] ${
            mobile ? "pr-2.5" : "pr-2.5 lg:pr-10"
          }`}
        />
        {mobile ? null : (
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 border border-neutral-800 px-1 font-mono text-[8px] text-neutral-600 lg:inline">
            /
          </kbd>
        )}
      </div>
      <button
        type="submit"
        className={`h-11 shrink-0 border border-neutral-800 bg-[#1a1a1a] px-3 font-mono text-[11px] tracking-wider text-neutral-400 hover:text-gain md:h-7 md:px-2 md:text-[9px] ${
          mobile ? "inline-flex items-center" : "hidden lg:inline-flex lg:items-center"
        }`}
      >
        GO
      </button>
      {showMenu && box && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label="Matching tickers"
              style={{ top: box.bottom + 4, left: menuLeft, width: menuWidth }}
              className="fixed z-50 max-h-64 overflow-y-auto rounded-md border border-neutral-800 bg-[#141414] shadow-2xl"
            >
              {results.length === 0 ? (
                <li className="px-2.5 py-2 font-mono text-[10px] text-neutral-600">
                  {shariahOnly ? "NO SHARIAH-COMPLIANT MATCH" : "NO TICKER MATCHES"}
                </li>
              ) : (
                results.map((entry, index) => {
                  const selected = index === activeIndex;
                  const aliasHit = aliasMatch(entry, query);
                  return (
                    <li key={entry.symbol} role="presentation">
                      <button
                        type="button"
                        id={`${listId}-${entry.symbol}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(entry)}
                        className={`flex min-h-11 w-full items-center gap-2 px-2.5 py-1.5 text-left md:min-h-0 ${
                          selected ? "bg-gain/10" : "hover:bg-[#1b1b1b]"
                        }`}
                      >
                        <span className="w-[46px] shrink-0 font-mono text-[10px] text-neutral-400">
                          <Highlight text={entry.code} query={query} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-100">
                          <Highlight text={entry.name} query={query} />
                          {aliasHit ? (
                            <span className="ml-1.5 font-mono text-[9px] text-neutral-500">
                              {" "}
                              <Highlight text={aliasHit} query={query} />
                            </span>
                          ) : null}
                        </span>
                        <span className="max-w-[4.5rem] shrink-0 truncate rounded-sm border border-neutral-800 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-neutral-500">
                          {entry.sector}
                        </span>
                        {entry.shariah ? (
                          <span title="Shariah-compliant" className="shrink-0 text-[10px]" aria-label="Shariah">
                            🌙
                          </span>
                        ) : (
                          <span className="w-3 shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}

function aliasMatch(entry: UniverseEntry, query: string): string | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  if (entry.code.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle)) {
    return null;
  }
  return entry.aliases.find((alias) => alias.toLowerCase().includes(needle)) ?? null;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return text;

  const lower = text.toLowerCase();
  const match = needle.toLowerCase();
  const index = lower.indexOf(match);
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-gain/25 text-gain">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}
