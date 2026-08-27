"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ConnectionStatus } from "@/components/connection-status";
import { HeaderAuth } from "@/components/header-auth";
import { Jargon } from "@/components/jargon-term";
import { NAV_ITEMS, type NavActive } from "@/components/main-nav";
import { SlideDrawer } from "@/components/slide-drawer";
import { TickerSearchField } from "@/components/ticker-search";
import { ToggleSwitch } from "@/components/toggle-switch";
import { SignedPct } from "@/components/signed-change";
import {
  formatFx,
  formatKlDate,
  formatOpr,
  formatPrice,
} from "@/lib/format";
import type { JargonTerm } from "@/lib/jargon";
import { feedStatusFromQuote, type FeedStatus } from "@/lib/market-status";
import type { BnmPayload, Quote } from "@/lib/types";
import type { TickPulse } from "@/lib/use-market-data";
import { usePriceFlash } from "@/lib/use-price-flash";
import { useShariahFilter } from "@/lib/use-shariah";

type HeaderBarProps = {
  bnm: BnmPayload | null;
  index: Quote | null;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  /** Rendered beside the brand, for page-to-page links. */
  nav?: ReactNode;
  /** Highlights the current route inside the mobile hamburger drawer. */
  active?: NavActive;
  feedStatus?: FeedStatus;
  ticks?: Record<string, TickPulse>;
  latencyMs?: number | null;
  actions?: ReactNode;
};

export function HeaderBar({
  bnm,
  index,
  onSearch,
  searchPlaceholder,
  nav,
  active,
  feedStatus,
  ticks = {},
  latencyMs = null,
  actions,
}: HeaderBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const status =
    feedStatus ??
    feedStatusFromQuote(index, { connected: index != null, loading: index == null });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = String(new FormData(event.currentTarget).get("ticker") ?? "");
    onSearch(submitted);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!searchOpen) return;
    mobileSearchRef.current?.focus();
  }, [searchOpen]);

  const placeholder = searchPlaceholder ?? "Search ticker — Maybank 1155.KL";
  const showShariahToggle = active === "market";
  const showDelayedBadge = active === "market";
  const showLiveBadge = active === "my-economy" || active === "global-economy";

  return (
    <header className="w-full shrink-0 overflow-hidden border-b border-neutral-800 bg-[#0d0d0d]">
      <div className="flex w-full min-h-[56px] items-center justify-between gap-2 overflow-hidden px-3 md:gap-4">
        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-neutral-800 text-neutral-300 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-nav-drawer"
            aria-label="Open navigation and market indicators"
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden className="flex flex-col gap-1">
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
            </span>
          </button>

          <Link
            href="/"
            title="Home"
            className="flex min-h-11 flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-r border-neutral-800 pr-2 md:min-h-0 md:items-baseline md:gap-2 md:pr-3"
          >
            <span className="text-[13px] font-semibold tracking-[0.08em] text-white md:tracking-[0.18em]">
              BURSA
            </span>
            <span className="text-[13px] font-semibold tracking-[0.08em] text-gain md:tracking-[0.18em]">
              TERMINAL
            </span>
          </Link>

          {nav}
        </div>

        <form
          onSubmit={handleSubmit}
          className="hidden w-48 shrink-0 items-center gap-1 md:flex lg:w-64"
        >
          <TickerSearchField id="ticker-search" placeholder="Search a ticker..." onSearch={onSearch} />
          <kbd className="hidden flex-shrink-0 whitespace-nowrap border border-neutral-800 px-1 py-0.5 font-mono text-[8px] text-neutral-600 lg:inline">
            Ctrl+K
          </kbd>
        </form>

        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 overflow-hidden md:gap-4 lg:ml-0 lg:flex-1">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center border border-neutral-800 text-neutral-300 md:hidden"
            aria-expanded={searchOpen}
            aria-controls="ticker-search-mobile-panel"
            aria-label={searchOpen ? "Close ticker search" : "Search tickers"}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <SearchIcon />
          </button>

          {showShariahToggle ? <ShariahToggle /> : null}

          {showDelayedBadge ? (
            <>
              <span className="hidden flex-shrink-0 whitespace-nowrap text-xs font-mono uppercase lg:inline-flex">
                <ConnectionStatus status={status} latencyMs={latencyMs} />
              </span>
              <span className="inline-flex flex-shrink-0 whitespace-nowrap text-xs font-mono uppercase lg:hidden">
                <ConnectionStatus status={status} compact latencyMs={latencyMs} />
              </span>
            </>
          ) : null}

          {showLiveBadge ? <RealtimeBadge /> : null}

          <HeaderAuth />

          {actions ? <div className="hidden flex-shrink-0 xl:block">{actions}</div> : null}

          <div className="hidden min-w-0 max-w-[min(100%,42rem)] flex-1 items-stretch divide-x divide-neutral-800 overflow-x-auto border border-neutral-800 scrollbar-none md:flex">
            <MacroTiles bnm={bnm} index={index} ticks={ticks} />
          </div>
        </div>
      </div>

      <form
        id="ticker-search-mobile-panel"
        onSubmit={handleSubmit}
        className={`${searchOpen ? "flex" : "hidden"} items-center gap-1 border-t border-neutral-800 px-3 py-2 md:hidden`}
      >
        <TickerSearchField
          id="ticker-search-mobile"
          placeholder={placeholder}
          inputRef={mobileSearchRef}
          mobile
          onSearch={onSearch}
          onPicked={() => setSearchOpen(false)}
        />
      </form>

      <SlideDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        side="bottom"
        title="Navigate & macros"
        bodyClassName="overflow-y-auto"
      >
        <nav id="app-nav-drawer" className="flex flex-col">
          {NAV_ITEMS.map((item) => {
            const selected = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-11 items-center border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] ${
                  selected ? "bg-gain/15 text-gain" : "text-neutral-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden grid-cols-2 gap-px border-t border-line bg-line md:grid">
          <MacroTiles bnm={bnm} index={index} ticks={ticks} stacked />
        </div>
      </SlideDrawer>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ShariahToggle() {
  const { shariahOnly, setShariahOnly } = useShariahFilter();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shariahOnly}
      onClick={() => setShariahOnly(!shariahOnly)}
      title={
        shariahOnly
          ? "Showing Shariah-compliant names only"
          : "Show Shariah-compliant names only — hides conventional banks, insurers, gaming and brewers"
      }
      className={`flex min-h-11 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-1 transition-colors md:min-h-0 md:px-2 ${
        shariahOnly
          ? "border-gain/50 bg-gain/10 text-gain"
          : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
      }`}
    >
      <span className="hidden font-mono text-[9px] uppercase tracking-wider lg:inline">
        Shariah Only
      </span>
      <span className="font-mono text-[9px] uppercase tracking-wider lg:hidden">🌙</span>
      <ToggleSwitch checked={shariahOnly} />
    </button>
  );
}

function RealtimeBadge() {
  return (
    <span
      title="Macro indicators stream live from TradingView and official APIs"
      className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-mono uppercase tracking-[0.12em] text-emerald-400"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="hidden sm:inline">Realtime · Live</span>
      <span className="sm:hidden">Live</span>
    </span>
  );
}

function MacroTiles({
  bnm,
  index,
  ticks,
  snap = false,
  stacked = false,
}: {
  bnm: BnmPayload | null;
  index: Quote | null;
  ticks: Record<string, TickPulse>;
  snap?: boolean;
  stacked?: boolean;
}) {
  const opr = bnm?.opr ?? null;
  const fx = (bnm?.rates ?? []).filter(
    (rate) => rate.pair === "USD/MYR" || rate.pair === "SGD/MYR" || rate.pair === "EUR/MYR",
  );
  const tileClass = snap ? "snap-start" : stacked ? "bg-panel" : "";
  const secondaryClass = stacked ? tileClass : `${tileClass} max-lg:hidden`.trim();

  return (
    <>
      {fx.map((rate) => (
        <Tile
          key={rate.pair}
          className={rate.pair === "USD/MYR" || stacked ? tileClass : secondaryClass}
          label={rate.pair}
          note={`BNM ${bnm?.session ?? ""} · ${formatKlDate(rate.date)}`}
          value={formatFx(rate.rate)}
          changePct={rate.changePct}
        />
      ))}

      {!bnm ? (
        <>
          <Tile className={tileClass} label="USD/MYR" note="BNM" value="—" changePct={null} />
          <Tile className={secondaryClass} label="SGD/MYR" note="BNM" value="—" changePct={null} />
          <Tile className={secondaryClass} label="EUR/MYR" note="BNM" value="—" changePct={null} />
        </>
      ) : null}

      <IndexTile index={index} ticks={ticks} className={secondaryClass} />

      <Tile
        className={secondaryClass}
        label="BNM OPR"
        term="opr"
        note={opr?.effectiveDate ? `eff. ${formatKlDate(opr.effectiveDate)}` : "BNM"}
        value={formatOpr(opr?.level)}
        changePct={null}
        badge={
          opr?.changeBps != null
            ? opr.changeBps === 0
              ? "UNCH"
              : `${opr.changeBps > 0 ? "+" : ""}${opr.changeBps}bps`
            : undefined
        }
      />
    </>
  );
}

function IndexTile({
  index,
  ticks,
  className,
}: {
  index: Quote | null;
  ticks: Record<string, TickPulse>;
  className?: string;
}) {
  const flash = usePriceFlash(index?.symbol, ticks);
  return (
    <Tile
      className={className}
      label="FBM KLCI"
      term="klci"
      note={index?.delayMinutes ? `^KLSE · ${index.delayMinutes}m delay` : "^KLSE"}
      value={formatPrice(index?.price)}
      changePct={index?.changePct ?? null}
      flash={flash}
    />
  );
}

type TileProps = {
  label: string;
  note: string;
  value: string;
  changePct: number | null;
  badge?: string;
  flash?: string;
  className?: string;
  /** Adds a definition to the label, for the tiles a beginner will not know. */
  term?: JargonTerm;
};

function Tile({ label, note, value, changePct, badge, term, flash, className = "" }: TileProps) {
  return (
    <div
      className={`flex min-h-11 min-w-[120px] shrink-0 flex-col justify-center px-2 py-1.5 lg:px-3 ${flash ?? ""} ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-500">
          {term ? (
            <Jargon term={term} align="right">
              {label}
            </Jargon>
          ) : (
            label
          )}
        </span>
        <span className="font-mono text-[8px] text-neutral-700">{note}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[12px] text-neutral-100">{value}</span>
        {badge ? (
          <span className="font-mono text-[10px] text-neutral-500">{badge}</span>
        ) : (
          <SignedPct value={changePct} className="font-mono text-[10px]" />
        )}
      </div>
    </div>
  );
}
