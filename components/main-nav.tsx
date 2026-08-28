"use client";

import Link from "next/link";
import { HEADLINE_CATEGORIES, deskHref, type HeadlineCategory } from "@/lib/categories";

export type NavActive =
  | "market"
  | "market-hub"
  | "quant-hub"
  | "screener"
  | "portfolio"
  | HeadlineCategory;

export const NAV_ITEMS: {
  id: NavActive;
  href: string;
  label: string;
  shortcut?: string;
  blurb?: string;
}[] = [
  { id: "market", href: "/terminal", label: "Bursa MY", shortcut: "Alt+1" },
  {
    id: "market-hub",
    href: "/terminal/market-hub",
    label: "Market Hub",
    blurb: "Indices, BMD, REITs, ETFs and institutional flows",
  },
  {
    id: "quant-hub",
    href: "/terminal/quant-hub",
    label: "Quant Hub",
    blurb: "Multi-factor signals, alternative data and rolling correlations",
  },
  { id: "screener", href: "/screener", label: "Screener" },
  { id: "portfolio", href: "/portfolio", label: "My Portfolio", shortcut: "Alt+2" },
  ...HEADLINE_CATEGORIES.map((tab) => ({
    id: tab.id,
    href: deskHref(tab.id),
    label: tab.label,
    shortcut:
      tab.id === "my-economy" ? "Alt+3" : tab.id === "my-politics" ? "Alt+4" : undefined,
    blurb: tab.blurb,
  })),
];

type MainNavProps = {
  active: NavActive;
};

/** Shared menu: Bursa MY is the terminal, My Portfolio is the book, news desks live on /news. Hidden below lg — the bottom drawer replaces it. */
export function MainNav({ active }: MainNavProps) {
  return (
    <nav className="hidden shrink-0 items-stretch overflow-x-auto border-b border-line bg-panel lg:flex">
      {NAV_ITEMS.map((item) => {
        const selected = item.id === active;
        const desk =
          item.id !== "market" &&
          item.id !== "market-hub" &&
          item.id !== "quant-hub" &&
          item.id !== "screener" &&
          item.id !== "portfolio";
        return (
          <Link
            key={item.id}
            href={item.href}
            title={item.blurb}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 border-r border-line px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors md:min-h-0 md:py-2 ${
              selected
                ? desk
                  ? "bg-[#1a1a1a] text-amber-400"
                  : "bg-gain/15 text-gain"
                : "text-neutral-500 hover:bg-[#161616] hover:text-neutral-300"
            }`}
          >
            {item.label}
            {item.shortcut ? (
              <kbd className="hidden font-mono text-[8px] font-normal normal-case tracking-normal text-neutral-600 lg:inline">
                {item.shortcut}
              </kbd>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
