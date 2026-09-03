"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { HeaderAuth } from "@/components/header-auth";
import { MarketOverview } from "@/components/market-overview";
import { SignedPct } from "@/components/signed-change";
import { NewsFeedSkeleton } from "@/components/skeleton";
import { formatFx, formatKlStamp, formatPrice } from "@/lib/format";
import { resolveMoversBoard } from "@/lib/movers-fallback";
import type {
  BnmPayload,
  EconomyPayload,
  MoversPayload,
  NewsPayload,
  QuotesPayload,
} from "@/lib/types";
import { terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useMarketData, type TickPulse } from "@/lib/use-market-data";
import { usePriceFlash } from "@/lib/use-price-flash";

const BNM_REFRESH_MS = 10 * 60 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;
const MOVERS_REFRESH_MS = 60 * 1000;

const ACCENT_GREEN = "#22c55e";
const ACCENT_RED = "#ef4444";

const FEATURES = [
  {
    id: "analytics",
    title: "Real-Time Bursa Analytics",
    body: "Candlestick charting, technical indicator toggles, live top gainers/losers feed, real-time corporate filing feeds, and multi-timeframe views.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 9l4-3 4 5 5-7 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "macro",
    title: "Macro & Policy Intelligence",
    body: "Live integration of Bank Negara Malaysia (BNM) OPR policy rates, DOSM CPI inflation and trade metrics, Ringgit FX rates, and FCPO futures.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 18h16M6 14l4-5 3 3 5-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    id: "shariah",
    title: "Shariah Screener & AI Filing Summaries",
    body: "One-click Shariah filtering across watchlists and search, combined with plain-English filing and headline summaries for quick research.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M9.5 12.5 11 14l3.5-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "quant",
    title: "Integrated Quant Hub & Advanced Analytics",
    body: "Institutional-grade quantitative modeling, including Monte Carlo price path simulations, strategy backtesting, Markowitz efficient frontier portfolio optimization, and factor signals.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 20V8M10 20V4M16 20v-6M22 20H2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M4 14c2-2 4-1 6 0s4 2 6 0 6-3 6-3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "mobile",
    title: "Mobile & Touch Responsive UI",
    body: "Responsive bottom sheets, touch-optimized controls, and single-row compact controls designed for mobile viewports.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <rect x="7" y="2.5" width="10" height="19" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 18.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9.5 6h5M9.5 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "discovery",
    title: "Discovery & Data Export",
    body: "Dynamic multi-factor stock screener, peer comparison matrix with sector highlighting, custom watchlists, and client-side CSV exports.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M15 15 20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 10.5h5M10.5 8v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

type TapeItem = {
  label: string;
  value: string;
  changePct: number | null;
  symbol?: string;
  tone?: "gain" | "loss" | "neutral";
};

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const quotes = useMarketData(["1155.KL", "1295.KL"]);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const economy = useLiveData<EconomyPayload>("/api/economy", BNM_REFRESH_MS);
  const movers = useLiveData<MoversPayload>("/api/movers", MOVERS_REFRESH_MS);
  const news = useLiveData<NewsPayload>("/api/news", NEWS_REFRESH_MS);

  const board = useMemo(() => resolveMoversBoard(movers.data), [movers.data]);
  const tape = buildTape(quotes.data, bnm.data, economy.data, board);
  const stories = (news.data?.items ?? []).slice(0, 6);

  return (
    <div className="min-h-full bg-[#0a0a0a] text-neutral-200">
      <LandingHeader menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((open) => !open)} onNavClick={() => setMenuOpen(false)} />

      {/* Section 1: Hero & Value Proposition */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.12),transparent_55%),linear-gradient(to_bottom,#0a0a0a,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-24">
          <div>
            <p
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{
                borderColor: `${ACCENT_GREEN}4d`,
                backgroundColor: `${ACCENT_GREEN}1a`,
                color: ACCENT_GREEN,
              }}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: ACCENT_GREEN }}
              />
              Live Malaysian market data
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
              The Financial Workspace Built for the Malaysian Market
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              Bursa stocks, Bank Negara rates, one-click Shariah screening, live filing feeds, and
              high-density analytics in a single terminal—built for investors who need the tape, the
              policy, and the macro picture in one glance.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LaunchButton href={terminalHref()} size="hero">
                Launch Free Terminal
              </LaunchButton>
              <a
                href="#markets"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/15 bg-[#121212] px-5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-[#161616]"
              >
                Explore Market Data
              </a>
            </div>
          </div>

          <HeroPreview
            klci={quotes.data?.index?.price ?? null}
            klciChange={quotes.data?.index?.changePct ?? null}
            opr={bnm.data?.opr?.level ?? null}
          />
        </div>
      </section>

      {/* Section 2: Core Platform Features Grid */}
      <section id="features" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: ACCENT_GREEN }}
        >
          Core platform
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Everything your Bursa desk needs
        </h2>
        <p className="mt-3 max-w-3xl text-neutral-400">
          Charting, policy intelligence, Shariah screening, quant modeling, mobile workflows, and
          discovery tools — without leaving Malaysia, and without a paid data terminal.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.id} {...feature} />
          ))}
        </div>
      </section>

      {/* Section 3: Live Market Preview Strip */}
      <MarketTapeStrip tape={tape} ticks={quotes.ticks} />

      <section
        id="markets"
        className="scroll-mt-20 border-t border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className="font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: ACCENT_GREEN }}
              >
                Market overview
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Today on Bursa Malaysia
              </h2>
            </div>
            <Link
              href={terminalHref()}
              className="inline-flex h-10 items-center rounded-md border px-4 text-[12px] font-semibold uppercase tracking-[0.12em] transition hover:brightness-110"
              style={{
                borderColor: `${ACCENT_GREEN}66`,
                backgroundColor: `${ACCENT_GREEN}1a`,
                color: ACCENT_GREEN,
              }}
            >
              Open Full Terminal for Live Feeds
            </Link>
          </div>

          <div className="mt-10 grid w-full max-w-full grid-cols-1 gap-4 overflow-x-hidden lg:grid-cols-2">
            <div className="min-w-0 w-full max-w-full overflow-hidden">
              <MarketOverview />
            </div>

            <div
              id="news"
              className="min-w-0 w-full max-w-full scroll-mt-20 overflow-hidden rounded-2xl border border-white/10 bg-[#121212] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white">
                  Trending local news
                </h3>
                <Link
                  href="/news"
                  className="font-mono text-[10px] text-neutral-500 hover:text-[#22c55e]"
                >
                  Full desk →
                </Link>
              </div>
              {news.loading && stories.length === 0 ? (
                <NewsFeedSkeleton rows={5} />
              ) : (
                <ul className="divide-y divide-white/5">
                  {stories.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.url ?? terminalHref()}
                        target={item.url ? "_blank" : undefined}
                        rel={item.url ? "noreferrer" : undefined}
                        title={item.headline}
                        className="flex flex-col gap-2 px-4 py-3 hover:bg-white/[0.03]"
                      >
                        <p className="line-clamp-2 min-w-0 overflow-hidden text-sm font-medium leading-snug text-neutral-100">
                          {item.headline}
                        </p>
                        <p className="flex min-w-0 items-center gap-2 font-mono text-[10px] text-zinc-400">
                          <span className="shrink-0">{item.tag}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate">{item.source}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{formatKlStamp(item.publishedAt)}</span>
                        </p>
                      </a>
                    </li>
                  ))}
                  {stories.length === 0 ? (
                    <li className="px-4 py-8 text-center font-mono text-[11px] text-neutral-600">
                      NO HEADLINES YET
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050505]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-[12px] font-semibold tracking-[0.22em] text-white">BURSA</span>
              <span
                className="text-[12px] font-semibold tracking-[0.22em]"
                style={{ color: ACCENT_GREEN }}
              >
                TERMINAL
              </span>
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              © {new Date().getFullYear()} Bursa Terminal. Bursa Terminal is an independent market
              data interface and is not affiliated with, endorsed by, or connected to Bursa Malaysia
              Berhad.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-400">
            <a href="#markets" className="hover:text-white">
              Markets
            </a>
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#news" className="hover:text-white">
              News
            </a>
            <Link href="/news" className="hover:text-white">
              News desk
            </Link>
            <Link href="/screener" className="hover:text-white">
              Screener
            </Link>
            <Link href="/portfolio" className="hover:text-white">
              Portfolio
            </Link>
            <Link href={terminalHref()} className="hover:opacity-80" style={{ color: ACCENT_GREEN }}>
              Launch Terminal
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function LandingHeader({
  menuOpen,
  onMenuToggle,
  onNavClick,
}: {
  menuOpen: boolean;
  onMenuToggle: () => void;
  onNavClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex h-5 w-[155px] shrink-0 items-center">
          <img
            src="/bursa-terminal-logo.png"
            alt="Bursa Terminal"
            width={155}
            height={20}
            className="h-5 w-[155px] object-contain object-left"
          />
        </Link>

        <nav className="ml-6 hidden items-center gap-6 text-[13px] text-neutral-400 md:flex">
          <a href="#markets" className="transition-colors hover:text-white">
            Markets
          </a>
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#news" className="transition-colors hover:text-white">
            News
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 w-11 items-center justify-center rounded-md border border-white/10 text-neutral-300 md:hidden"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            onClick={onMenuToggle}
          >
            <span className="sr-only">Menu</span>
            <span aria-hidden className="flex flex-col gap-1">
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
            </span>
          </button>
          <div className="grid grid-cols-2 items-center gap-2">
            <LaunchButton href={terminalHref()} size="header">
              Launch Terminal
            </LaunchButton>
            <HeaderAuth size="header" />
          </div>
        </div>
      </div>

      {menuOpen ? (
        <nav className="border-t border-white/10 px-4 py-3 md:hidden">
          {(["markets", "features", "news"] as const).map((section) => (
            <a
              key={section}
              href={`#${section}`}
              onClick={onNavClick}
              className="flex min-h-11 items-center py-2 text-sm capitalize text-neutral-300"
            >
              {section}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function FeatureCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <article className="group rounded-xl border border-white/10 bg-[#121212] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/15 sm:p-6">
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border"
        style={{
          borderColor: `${ACCENT_GREEN}4d`,
          backgroundColor: `${ACCENT_GREEN}14`,
          color: ACCENT_GREEN,
        }}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{body}</p>
    </article>
  );
}

function MarketTapeStrip({
  tape,
  ticks,
}: {
  tape: TapeItem[];
  ticks: Record<string, TickPulse>;
}) {
  if (tape.length === 0) return null;

  return (
    <div
      id="live-tape"
      className="scroll-mt-20 border-y border-white/10 bg-[#050505]"
      aria-label="Live market preview"
    >
      <div className="flex items-center gap-4 overflow-hidden py-3">
        <span
          className="hidden shrink-0 pl-4 font-mono text-[10px] uppercase tracking-[0.18em] sm:inline"
          style={{ color: ACCENT_GREEN }}
        >
          Live tape
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="tape-track flex">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0 items-center gap-8 px-6">
                {tape.map((item) => (
                  <TapeCell key={`${copy}-${item.label}-${item.value}`} item={item} ticks={ticks} />
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaunchButton({
  href,
  size,
  children,
}: {
  href: string;
  size: "header" | "hero";
  children: ReactNode;
}) {
  const sizing = size === "hero" ? "h-12 px-6 text-sm" : "h-9 w-full px-3.5 text-[12px]";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-md font-semibold text-[#052e16] shadow-[0_0_24px_rgba(34,197,94,0.45)] transition hover:bg-[#4ade80] hover:shadow-[0_0_36px_rgba(34,197,94,0.7)] ${sizing}`}
      style={{ backgroundColor: ACCENT_GREEN }}
    >
      {children}
    </Link>
  );
}

function HeroPreview({
  klci,
  klciChange,
  opr,
}: {
  klci: number | null;
  klciChange: number | null;
  opr: number | null;
}) {
  const fillId = `hero-fill-${useId().replace(/:/g, "")}`;

  return (
    <div className="relative hidden lg:block">
      <div
        className="absolute -inset-8 rounded-full blur-3xl"
        style={{ backgroundColor: `${ACCENT_GREEN}1a` }}
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            FBM KLCI · BNM OPR
          </span>
          <span className="font-mono text-[10px]" style={{ color: ACCENT_GREEN }}>
            SYS OK
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/10">
          <div className="px-4 py-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">FBM KLCI</p>
            <p className="mt-1 font-mono text-2xl text-white">{formatPrice(klci)}</p>
            <SignedPct value={klciChange} className="font-mono text-sm" />
          </div>
          <div className="px-4 py-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">BNM OPR</p>
            <p className="mt-1 font-mono text-2xl text-white">
              {opr != null ? `${opr.toFixed(2)}%` : "—"}
            </p>
            <p className="font-mono text-sm text-neutral-500">Overnight policy</p>
          </div>
        </div>
        <svg viewBox="0 0 320 92" className="h-28 w-full" aria-hidden style={{ color: ACCENT_GREEN }}>
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            points="0,70 24,62 48,66 72,48 96,52 120,36 144,42 168,28 192,34 216,22 240,30 264,18 288,26 320,14"
          />
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_GREEN} stopOpacity="0.28" />
            <stop offset="100%" stopColor={ACCENT_GREEN} stopOpacity="0" />
          </linearGradient>
          <polygon
            fill={`url(#${fillId})`}
            points="0,70 24,62 48,66 72,48 96,52 120,36 144,42 168,28 192,34 216,22 240,30 264,18 288,26 320,14 320,92 0,92"
          />
        </svg>
      </div>
    </div>
  );
}

function TapeCell({
  item,
  ticks,
}: {
  item: TapeItem;
  ticks: Record<string, TickPulse>;
}) {
  const flash = usePriceFlash(item.symbol, ticks);
  const labelTone =
    item.tone === "gain"
      ? ACCENT_GREEN
      : item.tone === "loss"
        ? ACCENT_RED
        : undefined;

  return (
    <li className={`flex items-baseline gap-2 px-1 ${flash}`}>
      <span
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{ color: labelTone ?? "#737373" }}
      >
        {item.label}
      </span>
      <span className="font-mono text-[13px] text-white">{item.value}</span>
      <SignedPct value={item.changePct} className="font-mono text-[11px]" />
    </li>
  );
}

function buildTape(
  quotes: QuotesPayload | null,
  bnm: BnmPayload | null,
  economy: EconomyPayload | null,
  board: ReturnType<typeof resolveMoversBoard>,
): TapeItem[] {
  const usd = bnm?.rates.find((rate) => rate.pair === "USD/MYR");
  const cpo = economy?.commodities.find((item) => item.id === "cpo");
  const brent = economy?.commodities.find((item) => item.id === "brent");

  const core: TapeItem[] = [
    {
      label: "FBM KLCI",
      value: formatPrice(quotes?.index?.price),
      changePct: quotes?.index?.changePct ?? null,
      symbol: quotes?.index?.symbol,
    },
    {
      label: "USD/MYR",
      value: formatFx(usd?.rate),
      changePct: usd?.changePct ?? null,
    },
    {
      label: "CPO Palm Oil",
      value: formatPrice(cpo?.price),
      changePct: cpo?.changePct ?? null,
    },
    {
      label: "Brent Crude",
      value: formatPrice(brent?.price),
      changePct: brent?.changePct ?? null,
    },
  ];

  const topGainers = board.gainers.slice(0, 3).map(
    (row): TapeItem => ({
      label: `${row.shortName} ▲`,
      value: formatPrice(row.quote.price),
      changePct: row.quote.changePct ?? null,
      symbol: row.symbol,
      tone: "gain",
    }),
  );

  const topLosers = board.losers.slice(0, 3).map(
    (row): TapeItem => ({
      label: `${row.shortName} ▼`,
      value: formatPrice(row.quote.price),
      changePct: row.quote.changePct ?? null,
      symbol: row.symbol,
      tone: "loss",
    }),
  );

  return [...core, ...topGainers, ...topLosers];
}
