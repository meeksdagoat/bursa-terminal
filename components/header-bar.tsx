"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import { ConnectionStatus } from "@/components/connection-status";
import { HScroll } from "@/components/h-scroll";
import { Jargon } from "@/components/jargon-term";
import { NAV_ITEMS, type NavActive } from "@/components/main-nav";
import { SlideDrawer } from "@/components/slide-drawer";
import {
  changeClass,
  formatFx,
  formatKlDate,
  formatOpr,
  formatPct,
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
  const status =
    feedStatus ??
    feedStatusFromQuote(index, { connected: index != null, loading: index == null });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = String(new FormData(event.currentTarget).get("ticker") ?? "");
    onSearch(submitted);
  }

  const placeholder = searchPlaceholder ?? "Search ticker — Maybank 1155.KL";

  return (
    <header className="shrink-0 border-b border-line bg-panel">
      <div className="flex min-h-12 items-center gap-2 px-3 py-1.5 md:h-12 md:gap-4 md:py-0">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-line text-neutral-300 lg:hidden"
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
          className="flex min-h-11 shrink-0 items-center gap-2 border-r border-line pr-3 md:min-h-0 md:items-baseline"
        >
          <span className="text-[13px] font-semibold tracking-[0.18em] text-white">BURSA</span>
          <span className="text-[13px] font-semibold tracking-[0.18em] text-gain">TERMINAL</span>
        </Link>

        {nav}

        <form onSubmit={handleSubmit} className="hidden min-w-0 max-w-md flex-1 items-center gap-1 md:flex">
          <SearchField id="ticker-search" placeholder={placeholder} />
          <kbd className="hidden shrink-0 border border-line px-1 py-0.5 font-mono text-[8px] text-neutral-600 lg:inline">
            Ctrl+K
          </kbd>
        </form>

        <ShariahToggle />

        <span className="hidden md:inline-flex">
          <ConnectionStatus status={status} latencyMs={latencyMs} />
        </span>
        <span className="md:hidden">
          <ConnectionStatus status={status} compact latencyMs={latencyMs} />
        </span>

        {actions}

        <div className="ml-auto hidden items-stretch divide-x divide-line border border-line lg:flex">
          <MacroTiles bnm={bnm} index={index} ticks={ticks} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1 border-t border-line px-3 py-2 md:hidden"
      >
        <SearchField id="ticker-search-mobile" placeholder={placeholder} />
      </form>

      <HScroll
        snap
        className="border-t border-line lg:hidden"
        aria-label="Market indicators"
      >
        <MacroTiles bnm={bnm} index={index} ticks={ticks} snap />
      </HScroll>

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
                className={`flex min-h-11 items-center border-b border-line px-4 text-[12px] font-semibold uppercase tracking-[0.14em] ${
                  selected ? "bg-gain/15 text-gain" : "text-neutral-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
          <MacroTiles bnm={bnm} index={index} ticks={ticks} stacked />
        </div>
      </SlideDrawer>
    </header>
  );
}

function SearchField({ id, placeholder }: { id: string; placeholder: string }) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Search tickers
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          name="ticker"
          type="search"
          placeholder={placeholder}
          className="h-11 w-full rounded-sm border border-line bg-[#0a0a0a] px-2.5 pr-10 font-mono text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-gain/50 md:h-7 md:text-[11px]"
        />
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 border border-line px-1 font-mono text-[8px] text-neutral-600">
          /
        </kbd>
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 border border-line bg-[#1a1a1a] px-3 font-mono text-[11px] tracking-wider text-neutral-400 hover:text-gain md:h-7 md:px-2 md:text-[9px]"
      >
        GO
      </button>
    </>
  );
}

/**
 * Owns its own state rather than taking props: every page renders the header,
 * and reading the shared store here is what makes the setting survive
 * navigation without threading it through each route.
 */
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
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 transition-colors md:min-h-0 ${
        shariahOnly
          ? "border-gain/50 bg-gain/10 text-gain"
          : "border-line text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
      }`}
    >
      <span className="hidden font-mono text-[9px] uppercase tracking-wider lg:inline">
        Shariah Only 🌙
      </span>
      <span className="font-mono text-[9px] uppercase tracking-wider lg:hidden">🌙</span>
      <span
        aria-hidden
        className={`relative h-3 w-6 rounded-full transition-colors ${
          shariahOnly ? "bg-gain/40" : "bg-[#2a2a2a]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-2 w-2 rounded-full transition-all ${
            shariahOnly ? "left-3.5 bg-gain" : "left-0.5 bg-neutral-500"
          }`}
        />
      </span>
    </button>
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

  return (
    <>
      {fx.map((rate) => (
        <Tile
          key={rate.pair}
          className={tileClass}
          label={rate.pair}
          note={`BNM ${bnm?.session ?? ""} · ${formatKlDate(rate.date)}`}
          value={formatFx(rate.rate)}
          changePct={rate.changePct}
        />
      ))}

      {!bnm ? (
        <>
          <Tile className={tileClass} label="USD/MYR" note="BNM" value="—" changePct={null} />
          <Tile className={tileClass} label="SGD/MYR" note="BNM" value="—" changePct={null} />
        </>
      ) : null}

      <IndexTile index={index} ticks={ticks} className={tileClass} />

      <Tile
        className={tileClass}
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
      className={`flex min-h-11 min-w-[148px] shrink-0 flex-col justify-center px-3 py-1.5 ${flash ?? ""} ${className}`}
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
          <span className={`font-mono text-[10px] ${changeClass(changePct)}`}>
            {formatPct(changePct)}
          </span>
        )}
      </div>
    </div>
  );
}
