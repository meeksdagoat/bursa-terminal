"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { MarketOverview } from "@/components/market-overview";
import { SignedPct } from "@/components/signed-change";
import { NewsFeedSkeleton } from "@/components/skeleton";
import { formatFx, formatKlStamp, formatPrice } from "@/lib/format";
import type {
  BnmPayload,
  EconomyPayload,
  NewsPayload,
  QuotesPayload,
} from "@/lib/types";
import { terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useMarketData, type TickPulse } from "@/lib/use-market-data";
import { usePriceFlash } from "@/lib/use-price-flash";

const BNM_REFRESH_MS = 10 * 60 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;

const FEATURES = [
  {
    id: "analytics",
    title: "Real-Time Bursa Analytics",
    body: "Candlestick charting, technical ranges, and sector watchlists covering the Malaysian Main Market — delayed only as far as the exchange feed.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: "macro",
    title: "Macro & Policy Intel",
    body: "Live Bank Negara OPR, DOSM CPI inflation tracking, and government policy news in one pane so the tape never drifts from the rates cycle.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 18h16M6 14l4-5 3 3 5-7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "shariah",
    title: "Shariah Screener & AI Summary",
    body: "One-click Shariah filtering across watchlists and search, plus plain-English filing and headline summaries for beginners.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
];

type TapeItem = {
  label: string;
  value: string;
  changePct: number | null;
  symbol?: string;
};

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const quotes = useMarketData(["1155.KL", "1295.KL"]);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const economy = useLiveData<EconomyPayload>("/api/economy", BNM_REFRESH_MS);
  const news = useLiveData<NewsPayload>("/api/news", NEWS_REFRESH_MS);

  const tape = buildTape(quotes.data, bnm.data, economy.data);
  const stories = (news.data?.items ?? []).slice(0, 6);

  return (
    <div className="min-h-full bg-[#0a0a0a] text-neutral-200">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-baseline gap-2">
            <span className="text-[13px] font-semibold tracking-[0.22em] text-white">BURSA</span>
            <span className="text-[13px] font-semibold tracking-[0.22em] text-gain">TERMINAL</span>
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
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">Menu</span>
              <span aria-hidden className="flex flex-col gap-1">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </button>
            <LaunchButton href={terminalHref()} size="header">
              Launch Terminal
            </LaunchButton>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-white/10 px-4 py-3 md:hidden">
            <a
              href="#markets"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center py-2 text-sm text-neutral-300"
            >
              Markets
            </a>
            <a
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center py-2 text-sm text-neutral-300"
            >
              Features
            </a>
            <a
              href="#news"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center py-2 text-sm text-neutral-300"
            >
              News
            </a>
          </nav>
        ) : null}
      </header>

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
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gain/30 bg-gain/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-gain">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gain" />
              Live Malaysian market data
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
              The Financial Workspace Built for the Malaysian Market
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              Bursa stocks, Bank Negara rates, and one-click Shariah screening in a single
              high-density terminal — built for investors who need the tape, the policy, and the
              filing in the same glance.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LaunchButton href={terminalHref()} size="hero">
                Launch Free Terminal
              </LaunchButton>
              <a
                href="#markets"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
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

      <div className="border-y border-white/10 bg-[#050505]">
        <div className="flex items-center gap-4 overflow-hidden py-3">
          <span className="hidden shrink-0 pl-4 font-mono text-[10px] uppercase tracking-[0.18em] text-gain sm:inline">
            Live
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="tape-track flex">
              {[0, 1].map((copy) => (
                <ul key={copy} className="flex shrink-0 items-center gap-8 px-6">
                  {tape.map((item) => (
                    <TapeCell
                      key={`${copy}-${item.label}`}
                      item={item}
                      ticks={quotes.ticks}
                    />
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section id="features" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gain">Platform</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Everything a Bursa desk needs
        </h2>
        <p className="mt-3 max-w-2xl text-neutral-400">
          Charting, policy, and screening — without leaving Malaysia, and without a paid data
          terminal.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-gain/30 bg-gain/10 text-gain">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="markets"
        className="scroll-mt-20 border-t border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gain">
                Market overview
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Today on Bursa Malaysia
              </h2>
            </div>
            <Link
              href={terminalHref()}
              className="inline-flex h-10 items-center rounded-md border border-gain/40 bg-gain/10 px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-gain hover:bg-gain/20"
            >
              Open Full Terminal for Live Feeds
            </Link>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <MarketOverview />

            <div
              id="news"
              className="scroll-mt-20 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white">
                  Trending local news
                </h3>
                <Link href="/news" className="font-mono text-[10px] text-neutral-500 hover:text-gain">
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
              <span className="text-[12px] font-semibold tracking-[0.22em] text-gain">TERMINAL</span>
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              © {new Date().getFullYear()} Bursa Terminal. Delayed quotes · not investment advice.
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
            <Link href="/portfolio" className="hover:text-white">
              Portfolio
            </Link>
            <Link href={terminalHref()} className="text-gain hover:text-gain/80">
              Launch Terminal
            </Link>
          </nav>
        </div>
      </footer>
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
  const sizing =
    size === "hero"
      ? "h-12 px-6 text-sm"
      : "h-9 px-3.5 text-[12px]";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-md bg-gain font-semibold text-[#052e16] shadow-[0_0_24px_rgba(34,197,94,0.45)] transition hover:bg-[#4ade80] hover:shadow-[0_0_36px_rgba(34,197,94,0.7)] ${sizing}`}
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
      <div className="absolute -inset-8 rounded-full bg-gain/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c]/80 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            FBM KLCI · BNM OPR
          </span>
          <span className="font-mono text-[10px] text-gain">SYS OK</span>
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
        <svg viewBox="0 0 320 92" className="h-28 w-full text-gain" aria-hidden>
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            points="0,70 24,62 48,66 72,48 96,52 120,36 144,42 168,28 192,34 216,22 240,30 264,18 288,26 320,14"
          />
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(34,197,94)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="rgb(34,197,94)" stopOpacity="0" />
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
  return (
    <li className={`flex items-baseline gap-2 px-1 ${flash}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
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
): TapeItem[] {
  const usd = bnm?.rates.find((rate) => rate.pair === "USD/MYR");
  const cpo = economy?.commodities.find((item) => item.id === "cpo");
  const brent = economy?.commodities.find((item) => item.id === "brent");
  const maybank = quotes?.quotes.find((quote) => quote.symbol === "1155.KL");
  const publicBank = quotes?.quotes.find((quote) => quote.symbol === "1295.KL");

  return [
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
    {
      label: "Maybank",
      value: formatPrice(maybank?.price),
      changePct: maybank?.changePct ?? null,
      symbol: "1155.KL",
    },
    {
      label: "Public Bank",
      value: formatPrice(publicBank?.price),
      changePct: publicBank?.changePct ?? null,
      symbol: "1295.KL",
    },
  ];
}
