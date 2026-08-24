"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { deskHref, HEADLINE_CATEGORIES } from "@/lib/categories";
import { findEntry, searchUniverse, terminalHref } from "@/lib/universe";
import { useShariahOnly } from "@/lib/use-shariah";

type CommandPaletteProps = {
  onClose: () => void;
};

const PAGES = [
  { label: "Home", hint: "", href: "/" },
  { label: "Bursa MY", hint: "Alt+1", href: "/terminal" },
  { label: "My Portfolio", hint: "Alt+2", href: "/portfolio" },
  { label: "Economy", hint: "Alt+3", href: deskHref("my-economy") },
  { label: "Global Economy", hint: "", href: deskHref("global-economy") },
  { label: "Politics", hint: "Alt+4", href: deskHref("my-politics") },
  ...HEADLINE_CATEGORIES.filter(
    (tab) => tab.id !== "my-economy" && tab.id !== "my-politics" && tab.id !== "global-economy",
  ).map((tab) => ({ label: tab.label, hint: "", href: deskHref(tab.id) })),
];

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const router = useRouter();
  const shariahOnly = useShariahOnly();
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tickers = useMemo(() => {
    if (!query.trim()) return [];
    const matches = searchUniverse(query, 8);
    return shariahOnly ? matches.filter((entry) => entry.shariah) : matches;
  }, [query, shariahOnly]);

  const pages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PAGES;
    return PAGES.filter((page) => page.label.toLowerCase().includes(needle));
  }, [query]);

  function go(href: string) {
    router.push(href);
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const match = tickers[0] ?? findEntry(query, { shariahOnly });
    if (match) {
      go(terminalHref(match.symbol));
      return;
    }
    if (pages[0]) go(pages[0].href);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 md:items-start md:p-4 md:pt-[12vh]">
      <button type="button" aria-label="Close command bar" onClick={onClose} className="absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        className="relative w-full max-h-[88dvh] overflow-hidden rounded-t-lg border border-line bg-panel shadow-2xl md:w-[min(520px,94vw)] md:max-h-none md:rounded-none"
      >
        <form onSubmit={handleSubmit} className="border-b border-line p-2">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to ticker or desk — Maybank / Economy"
            className="h-11 w-full border border-line bg-[#0a0a0a] px-3 font-mono text-base text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-gain/50 md:h-9 md:text-[12px]"
          />
        </form>
        <ul className="max-h-[50vh] overflow-auto">
          {pages.map((page) => (
            <li key={page.href}>
              <button
                type="button"
                onClick={() => go(page.href)}
                className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left hover:bg-[#161616] md:min-h-0"
              >
                <span className="text-[12px] text-neutral-100">{page.label}</span>
                {page.hint ? (
                  <kbd className="font-mono text-[9px] text-neutral-600">{page.hint}</kbd>
                ) : null}
              </button>
            </li>
          ))}
          {tickers.map((entry) => (
            <li key={entry.symbol}>
              <button
                type="button"
                onClick={() => go(terminalHref(entry.symbol))}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#161616] md:min-h-0"
              >
                <span className="w-12 font-mono text-[10px] text-neutral-500">{entry.code}</span>
                <span className="text-[12px] text-neutral-100">{entry.name}</span>
                <span className="ml-auto font-mono text-[9px] text-neutral-600">{entry.sector}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-3 py-1.5 font-mono text-[9px] text-neutral-600">
          ENTER TO OPEN · ESC TO CLOSE · / FOCUSES HEADER SEARCH
          {shariahOnly ? <span className="text-gain/80"> · SHARIAH ONLY</span> : null}
        </p>
      </div>
    </div>
  );
}
