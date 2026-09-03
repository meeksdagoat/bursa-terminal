"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { AllocationDonut } from "@/components/allocation-donut";
import { SignInModal } from "@/components/auth/SignInModal";
import { ExportCsvButton } from "@/components/export-csv-button";
import { HeaderBar } from "@/components/header-bar";
import { stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { MainNav } from "@/components/main-nav";
import { SignedPct } from "@/components/signed-change";
import { KpiSkeleton, SparklineSkeleton, TableSkeleton } from "@/components/skeleton";
import { ValueSparkline } from "@/components/value-sparkline";
import { csvFilename } from "@/hooks/useExportToCSV";
import {
  downloadCsv,
  estimateDividends,
  holdingsCsvRows,
  stampFilename,
} from "@/lib/export";
import {
  changeClass,
  formatKlTime,
  formatMarketState,
  formatPrice,
  formatRinggit,
  formatShares,
  postSessionBadge,
} from "@/lib/format";
import {
  PORTFOLIO_RANGES,
  historyFromIso,
  formatHoldingDay,
  klToday,
  portfolioValueSeries,
  toDateInputValue,
  rangeStartMs,
  startPrice,
  type PortfolioRange,
  type Transaction,
} from "@/lib/portfolio";
import type { BnmPayload, HistoryPayload } from "@/lib/types";
import { entryBySymbol, findEntry, searchUniverse, terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useMarketData } from "@/lib/use-market-data";
import { usePortfolio } from "@/lib/use-portfolio";
import { useShariahOnly } from "@/lib/use-shariah";

const BNM_REFRESH_MS = 10 * 60 * 1000;
const HISTORY_REFRESH_MS = 10 * 60 * 1000;

const SLICE_COLORS = [
  "#22c55e",
  "#38bdf8",
  "#eab308",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#f97316",
  "#f472b6",
  "#84cc16",
  "#818cf8",
];

const RANGE_LABEL: Record<PortfolioRange, string> = {
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  YTD: "YTD",
  "1Y": "1Y",
  "5Y": "5Y",
  ALL: "All",
};

type PortfolioTab = "holdings" | "transactions" | "dividends";

export function PortfolioDashboard() {
  const { status } = useSession();
  if (status !== "authenticated") return <LockedPortfolioPage />;
  return <AuthenticatedPortfolioDashboard />;
}

function LockedPortfolioPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const quotes = useMarketData([]);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);

  return (
    <div className="flex min-h-full flex-col touch-pan-y bg-terminal text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={(query) => {
          const entry = findEntry(query);
          router.push(entry ? terminalHref(entry.symbol) : terminalHref());
        }}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="portfolio"
        feedStatus={quotes.status}
        ticks={quotes.ticks}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="portfolio" />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div aria-hidden className="pointer-events-none select-none">
          <MockPortfolioPreview />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-xl border border-line bg-panel px-6 py-8 text-center text-neutral-200 shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Locked</p>
            <h1 className="mt-2 text-[16px] font-semibold tracking-tight text-white">
              Sign in to track your portfolio
            </h1>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              Holdings, live P&amp;L, and allocation are available after you sign in.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-gain px-3.5 font-mono text-[12px] font-semibold text-[#052e16] transition-colors hover:bg-[#4ade80]"
            >
              SIGN IN
            </button>
          </div>
        </div>
      </div>

      <SignInModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function AuthenticatedPortfolioDashboard() {
  const router = useRouter();
  const portfolio = usePortfolio();
  const shariahOnly = useShariahOnly();
  const [range, setRange] = useState<PortfolioRange>("ALL");
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [boughtDate, setBoughtDate] = useState(() => toDateInputValue(klToday()));
  const [formError, setFormError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [fees, setFees] = useState("0");
  const [tab, setTab] = useState<PortfolioTab>("holdings");
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellFees, setSellFees] = useState("0");
  const [sellDate, setSellDate] = useState(() => toDateInputValue(klToday()));
  const reportRef = useRef<HTMLDivElement | null>(null);

  const symbols = useMemo(
    () => [...new Set(portfolio.holdings.map((row) => row.symbol))].sort(),
    [portfolio.holdings],
  );

  const historyUrl = useMemo(() => {
    const from = historyFromIso(range, portfolio.holdings);
    if (symbols.length === 0) return `/api/history?symbols=&from=${from}`;
    return `/api/history?symbols=${encodeURIComponent(symbols.join(","))}&from=${from}`;
  }, [symbols, range, portfolio.holdings]);

  const quotes = useMarketData(symbols);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const history = useLiveData<HistoryPayload>(historyUrl, HISTORY_REFRESH_MS);

  const quoteBySymbol = quotes.quoteBySymbol;

  const suggestions = useMemo(() => {
    if (query.trim().length === 0) return [];
    const matches = searchUniverse(query, 8);
    return shariahOnly ? matches.filter((entry) => entry.shariah) : matches;
  }, [query, shariahOnly]);

  const windowStart = rangeStartMs(range, portfolio.holdings);
  const series = history.data?.series ?? {};

  const rows = useMemo(() => {
    return portfolio.holdings.map((holding) => {
      const entry = entryBySymbol(holding.symbol);
      const quote = quoteBySymbol.get(holding.symbol) ?? null;
      const last = quote?.price ?? null;
      const costBasis = holding.quantity * holding.costPerShare;
      const value = last != null ? holding.quantity * last : null;
      const pnl = value != null ? value - costBasis : null;
      const pnlPct = costBasis > 0 && pnl != null ? (pnl / costBasis) * 100 : null;
      const startPx = startPrice(holding, range, windowStart, series[holding.symbol]);
      const startValue = startPx != null ? holding.quantity * startPx : null;
      const periodPnl = value != null && startValue != null ? value - startValue : null;
      const periodPct =
        startValue != null && startValue > 0 && periodPnl != null ? (periodPnl / startValue) * 100 : null;

      return {
        holding,
        entry,
        quote,
        last,
        cost: costBasis,
        value,
        pnl,
        pnlPct,
        periodPnl,
        periodPct,
      };
    });
  }, [portfolio.holdings, quoteBySymbol, range, windowStart, series]);

  const totals = useMemo(() => {
    let costBasis = 0;
    let value = 0;
    let start = 0;
    let valued = 0;

    for (const row of rows) {
      costBasis += row.cost;
      if (row.value != null) {
        value += row.value;
        valued += 1;
      }
      const px = startPrice(row.holding, range, windowStart, series[row.holding.symbol]);
      if (px != null) start += row.holding.quantity * px;
    }

    const pnl = valued > 0 ? value - costBasis : null;
    const pnlPct = costBasis > 0 && pnl != null ? (pnl / costBasis) * 100 : null;
    const periodPnl = valued > 0 && start > 0 ? value - start : null;
    const periodPct = start > 0 && periodPnl != null ? (periodPnl / start) * 100 : null;

    return { cost: costBasis, value: valued > 0 ? value : null, pnl, pnlPct, periodPnl, periodPct };
  }, [rows, range, windowStart, series]);

  const slices = useMemo(() => {
    return rows
      .filter((row) => (row.value ?? 0) > 0)
      .map((row, index) => ({
        id: row.holding.id,
        label: row.entry?.name ?? row.holding.symbol,
        value: row.value ?? 0,
        color: SLICE_COLORS[index % SLICE_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const sparkline = useMemo(
    () => portfolioValueSeries(portfolio.holdings, series, windowStart),
    [portfolio.holdings, series, windowStart],
  );

  function handleHeaderSearch(raw: string) {
    const match = findEntry(raw, { shariahOnly });
    if (match) {
      setSearchHint(null);
      router.push(terminalHref(match.symbol));
      return;
    }
    setSearchHint(shariahOnly ? "No Shariah-compliant match" : "No match in the Bursa universe");
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const entry = picked ? entryBySymbol(picked) : findEntry(query, { shariahOnly });
    if (!entry) {
      setFormError("Pick a Bursa ticker from the suggestions");
      return;
    }
    if (shariahOnly && !entry.shariah) {
      setFormError("That ticker is not on the Shariah list");
      return;
    }

    const error = portfolio.upsert({
      symbol: entry.symbol,
      quantity: Number(quantity),
      costPerShare: Number(cost),
      boughtAt: toDateInputValue(boughtDate),
      fees: Number(fees) || 0,
    });

    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setQuery("");
    setPicked(null);
    setQuantity("");
    setCost("");
    setFees("0");
    setBoughtDate(toDateInputValue(klToday()));
  }

  const todayPnl = useMemo(() => {
    let pnl = 0;
    let have = false;
    for (const row of rows) {
      if (row.quote?.change == null) continue;
      pnl += row.holding.quantity * row.quote.change;
      have = true;
    }
    return have ? pnl : null;
  }, [rows]);

  const todayPct = useMemo(() => {
    if (todayPnl == null || totals.value == null) return null;
    const start = totals.value - todayPnl;
    if (start <= 0) return null;
    return (todayPnl / start) * 100;
  }, [todayPnl, totals.value]);

  const realizedPnl = useMemo(() => {
    const sells = portfolio.transactions.filter((row) => row.type === "sell");
    if (sells.length === 0) return null;
    return sells.reduce((sum, row) => sum + (row.realizedPnl ?? 0), 0);
  }, [portfolio.transactions]);

  const winRate = useMemo(() => {
    const sells = portfolio.transactions.filter((row) => row.type === "sell");
    if (sells.length === 0) return null;
    const wins = sells.filter((row) => (row.realizedPnl ?? 0) > 0).length;
    return (wins / sells.length) * 100;
  }, [portfolio.transactions]);

  const dividends = useMemo(
    () => estimateDividends(portfolio.holdings, quoteBySymbol),
    [portfolio.holdings, quoteBySymbol],
  );

  function openSell(row: (typeof rows)[number]) {
    setSellingId(row.holding.id);
    setSellQty(String(row.holding.quantity));
    setSellPrice(row.last != null ? String(row.last) : String(row.holding.costPerShare));
    setSellFees("0");
    setSellDate(toDateInputValue(klToday()));
    setFormError(null);
  }

  function handleSell(event: FormEvent) {
    event.preventDefault();
    if (!sellingId) return;
    const error = portfolio.sell({
      holdingId: sellingId,
      quantity: Number(sellQty),
      price: Number(sellPrice),
      fees: Number(sellFees) || 0,
      date: sellDate,
    });
    if (error) {
      setFormError(error);
      return;
    }
    setSellingId(null);
    setFormError(null);
  }

  return (
    <div className="flex min-h-full flex-col touch-pan-y bg-terminal text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleHeaderSearch}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="portfolio"
        feedStatus={quotes.status}
        ticks={quotes.ticks}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="portfolio" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <div
        ref={reportRef}
        id="portfolio-report"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-white">My Portfolio</h1>
            <p className="mt-0.5 text-[12px] text-neutral-500">
              Saved locally · live Yahoo marks · P&amp;L vs buy price, windows vs the tape
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportCsvButton
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  csvFilename("Portfolio", "Holdings"),
                  holdingsCsvRows(
                    rows.map((row) => ({
                      symbol: row.holding.symbol,
                      name: row.entry?.name ?? row.holding.symbol,
                      quantity: row.holding.quantity,
                      costPerShare: row.holding.costPerShare,
                      last: row.last,
                      value: row.value,
                      pnl: row.pnl,
                      boughtAt: row.holding.boughtAt,
                    })),
                  ),
                )
              }
            />
            <div className="flex w-full overflow-x-auto border border-line sm:w-auto sm:overflow-hidden">
              {PORTFOLIO_RANGES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={`min-h-11 min-w-11 flex-1 px-2.5 font-mono text-[11px] uppercase tracking-wider sm:flex-none md:min-h-0 md:py-1 md:text-[10px] ${
                    range === key
                      ? "bg-gain/15 text-gain"
                      : "text-neutral-500 hover:bg-[#161616] hover:text-neutral-300"
                  }`}
                >
                  {RANGE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-4">
          {quotes.loading && quotes.data == null ? (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            <>
          <Kpi label="Total portfolio value" value={formatRinggit(totals.value)} />
          <Kpi
            label="Unrealised P&L"
            value={formatRinggit(totals.pnl, true)}
            hint={<SignedPct value={totals.pnlPct} />}
            tone={totals.pnl}
          />
          <Kpi
            label="Total realised P&L"
            value={formatRinggit(realizedPnl, true)}
            tone={realizedPnl}
          />
          <Kpi
            label="Win rate"
            value={winRate != null ? `${winRate.toFixed(1)}%` : "—"}
            hint={`${portfolio.transactions.filter((row) => row.type === "sell").length} closed trades`}
            tone={winRate != null ? winRate - 50 : null}
          />
            </>
          )}
        </section>

        <section className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
          {quotes.loading && quotes.data == null ? (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            <>
          <Kpi label="Cost basis" value={formatRinggit(totals.cost > 0 ? totals.cost : null)} />
          <Kpi
            label={`${RANGE_LABEL[range]} return`}
            value={formatRinggit(totals.periodPnl, true)}
            hint={<SignedPct value={totals.periodPct} />}
            tone={totals.periodPnl}
          />
          <Kpi
            label="Today"
            value={formatRinggit(todayPnl, true)}
            hint={<SignedPct value={todayPct} />}
            badge={postSessionBadge(quotes.data?.marketState)}
            tone={todayPnl}
          />
            </>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="border border-line bg-panel p-4">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
              Weight by market value
            </h2>
            <AllocationDonut slices={slices} />
          </section>

          <section className="border border-line bg-panel p-4">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
              {RANGE_LABEL[range]} mark-to-market
            </h2>
            {history.loading && sparkline.length === 0 ? (
              <SparklineSkeleton />
            ) : (
              <ValueSparkline points={sparkline} />
            )}
            {history.error ? (
              <p className="mt-2 font-mono text-[10px] text-loss">HISTORY FEED · {history.error}</p>
            ) : null}
          </section>
        </div>

        <section className="border border-line bg-panel">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
              Add a holding
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Same ticker again averages into one line (weighted cost, earliest buy date).
            </p>
          </div>

          <form
            onSubmit={handleAdd}
            className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.65fr))_auto]"
          >
            <div className="relative">
              <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                Ticker
              </label>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPicked(null);
                }}
                placeholder="Maybank / 1155"
                className="h-11 w-full border border-line bg-[#0a0a0a] px-2.5 font-mono text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-gain/50 md:h-8 md:text-[11px]"
              />
              {suggestions.length > 0 && !picked ? (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto border border-line bg-[#0e0e0e]">
                  {suggestions.map((entry) => (
                    <li key={entry.symbol}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(entry.symbol);
                          setQuery(`${entry.name} (${entry.code})`);
                        }}
                        className="flex min-h-11 w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[#161616] md:min-h-0"
                      >
                        <span className="font-mono text-[10px] text-neutral-500">{entry.code}</span>
                        <span className="truncate text-[12px] text-neutral-100">{entry.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Field label="Shares" value={quantity} onChange={setQuantity} placeholder="1000" />
            <Field label="Buy price (RM)" value={cost} onChange={setCost} placeholder="10.50" />
            <Field label="Fees (RM)" value={fees} onChange={setFees} placeholder="0.00" />
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                Bought Date
              </span>
              <input
                type="date"
                name="boughtDate"
                value={boughtDate}
                onChange={(e) => setBoughtDate(e.target.value)}
                className="date-input h-11 w-full border border-line bg-[#0a0a0a] px-2 font-mono text-base text-neutral-200 outline-none focus:border-gain/50 md:h-8 md:text-[11px]"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full border border-gain/40 bg-gain/10 px-4 font-mono text-[11px] uppercase tracking-wider text-gain hover:bg-gain/20 md:h-8 md:text-[10px]"
              >
                Add
              </button>
            </div>
          </form>
          {sellingId ? (
            <form
              onSubmit={handleSell}
              className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-400 sm:col-span-2 lg:col-span-6">
                Sell {rows.find((row) => row.holding.id === sellingId)?.entry?.name ?? "holding"}
              </p>
              <Field label="Shares" value={sellQty} onChange={setSellQty} placeholder="100" />
              <Field label="Sell price (RM)" value={sellPrice} onChange={setSellPrice} placeholder="10.80" />
              <Field label="Fees (RM)" value={sellFees} onChange={setSellFees} placeholder="0.00" />
              <label className="block">
                <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                  Trade date
                </span>
                <input
                  type="date"
                  value={sellDate}
                  onChange={(event) => setSellDate(event.target.value)}
                  className="date-input h-11 w-full border border-line bg-[#0a0a0a] px-2 font-mono text-base text-neutral-200 outline-none focus:border-gain/50 md:h-8 md:text-[11px]"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="h-11 w-full border border-loss/40 bg-loss/10 px-4 font-mono text-[11px] uppercase tracking-wider text-loss hover:bg-loss/20 md:h-8 md:text-[10px]"
                >
                  Confirm sell
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setSellingId(null)}
                  className="h-11 w-full border border-line px-4 font-mono text-[11px] uppercase tracking-wider text-neutral-400 md:h-8 md:text-[10px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {formError ? (
            <p className="border-t border-line px-4 py-2 font-mono text-[10px] text-amber-400">{formError}</p>
          ) : null}
        </section>

        <section className="border border-line bg-panel px-4 py-3 print-report">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Market notes
          </h2>
          <p className="mt-1 font-mono text-[11px] text-neutral-400">
            FBM KLCI {formatPrice(quotes.data?.index?.price)} (
            <SignedPct value={quotes.data?.index?.changePct} className="font-mono text-[11px]" />) ·{" "}
            {formatMarketState(quotes.data?.marketState)} · Yahoo{" "}
            {quotes.data?.delayMinutes != null ? `${quotes.data.delayMinutes}m delay` : "delayed"} · Updated{" "}
            {formatKlTime(quotes.updatedAt)} MYT · {portfolio.holdings.length} open lots stored in this
            browser.
          </p>
        </section>

        <div className="flex border border-line bg-panel">
          {(
            [
              ["holdings", "Holdings"],
              ["transactions", "Transaction History"],
              ["dividends", "Dividends"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-11 flex-1 px-3 font-mono text-[11px] uppercase tracking-[0.14em] md:flex-none md:px-4 ${
                tab === id ? "bg-gain/15 text-gain" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "transactions" ? (
          <TransactionTable transactions={portfolio.transactions} />
        ) : null}

        {tab === "dividends" ? <DividendTable rows={dividends} /> : null}

        {tab === "holdings" ? (
        quotes.loading && quotes.data == null && rows.length > 0 ? (
          <section className="min-w-0 border border-line bg-panel">
            <TableSkeleton rows={Math.min(rows.length, 8)} cols={6} />
          </section>
        ) : (
        <section className="min-w-0 border border-line bg-panel">
          <div className="divide-y divide-line md:hidden">
            {rows.map((row) => {
              const weight =
                totals.value && row.value != null ? (row.value / totals.value) * 100 : null;
              return (
                <article key={row.holding.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={terminalHref(row.holding.symbol)} className="min-w-0">
                      <span className="block text-[14px] text-neutral-100">
                        {row.entry?.name ?? row.holding.symbol}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-600">{row.holding.symbol}</span>
                    </Link>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openSell(row)}
                        className="min-h-11 shrink-0 px-2 font-mono text-[11px] text-neutral-400 hover:text-amber-300"
                      >
                        Sell
                      </button>
                      <button
                        type="button"
                        onClick={() => portfolio.remove(row.holding.id)}
                        className="min-h-11 shrink-0 px-2 font-mono text-[11px] text-neutral-500 hover:text-loss"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        Shares
                      </span>
                      <TinyInput
                        value={String(row.holding.quantity)}
                        onCommit={(next) => portfolio.update(row.holding.id, { quantity: Number(next) })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        Buy px
                      </span>
                      <TinyInput
                        value={String(row.holding.costPerShare)}
                        onCommit={(next) =>
                          portfolio.update(row.holding.id, { costPerShare: Number(next) })
                        }
                      />
                    </label>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Last</dt>
                      <dd className="text-neutral-100">{formatPrice(row.last)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Value</dt>
                      <dd className="text-neutral-100">{formatRinggit(row.value)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Wt</dt>
                      <dd className="text-neutral-400">{weight != null ? `${weight.toFixed(1)}%` : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">Bought</dt>
                      <dd className="text-neutral-300">{formatHoldingDay(row.holding.boughtAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">P&amp;L</dt>
                      <dd className={`inline-flex items-center gap-2 ${changeClass(row.pnl)}`}>
                        <span>{formatRinggit(row.pnl, true)}</span>
                        <SignedPct value={row.pnlPct} className="text-[12px]" />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">{RANGE_LABEL[range]}</dt>
                      <dd className={`inline-flex items-center gap-2 ${changeClass(row.periodPnl)}`}>
                        <span>{formatRinggit(row.periodPnl, true)}</span>
                        <SignedPct value={row.periodPct} className="text-[12px]" />
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
            {rows.length === 0 ? (
              <p className="px-3 py-10 text-center font-mono text-[11px] text-neutral-600">
                ADD A TICKER, SHARE COUNT AND BUY PRICE TO START TRACKING
              </p>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto overscroll-x-contain touch-pan-x md:block">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <th className={`${stickyHeadClass} text-left`}>Name</th>
                <th className={`${tableHeadClass} text-right`}>Shares</th>
                <th className={`${tableHeadClass} text-right`}>Buy px</th>
                <th className={`${tableHeadClass} text-right`}>Last</th>
                <th className={`${tableHeadClass} text-right`}>Value</th>
                <th className={`${tableHeadClass} text-right`}>Wt</th>
                <th className={`${tableHeadClass} text-right`}>P&amp;L</th>
                <th className={`${tableHeadClass} text-right`}>{RANGE_LABEL[range]}</th>
                <th className={`${tableHeadClass} text-left`}>Bought</th>
                <th className={tableHeadClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const weight =
                  totals.value && row.value != null ? (row.value / totals.value) * 100 : null;

                return (
                  <tr key={row.holding.id} className="hover:bg-[#161616]">
                    <td className={stickyCellClass}>
                      <Link href={terminalHref(row.holding.symbol)} className="block">
                        <span className="block text-neutral-100">
                          {row.entry?.name ?? row.holding.symbol}
                        </span>
                        <span className="font-mono text-[9px] text-neutral-600">{row.holding.symbol}</span>
                      </Link>
                    </td>
                    <td className={tableCellClass}>
                      <TinyInput
                        value={String(row.holding.quantity)}
                        onCommit={(next) => portfolio.update(row.holding.id, { quantity: Number(next) })}
                      />
                    </td>
                    <td className={tableCellClass}>
                      <TinyInput
                        value={String(row.holding.costPerShare)}
                        onCommit={(next) => portfolio.update(row.holding.id, { costPerShare: Number(next) })}
                      />
                    </td>
                    <td className={`${tableCellClass} text-right font-mono text-neutral-100`}>{formatPrice(row.last)}</td>
                    <td className={`${tableCellClass} text-right font-mono text-neutral-100`}>{formatRinggit(row.value)}</td>
                    <td className={`${tableCellClass} text-right font-mono text-neutral-400`}>
                      {weight != null ? `${weight.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <p className={`font-mono text-[12px] ${changeClass(row.pnl)}`}>
                        {formatRinggit(row.pnl, true)}
                      </p>
                      <SignedPct value={row.pnlPct} className="font-mono text-[10px]" />
                    </td>
                    <td className="px-3 py-2">
                      <p className={`font-mono text-[12px] ${changeClass(row.periodPnl)}`}>
                        {formatRinggit(row.periodPnl, true)}
                      </p>
                      <SignedPct value={row.periodPct} className="font-mono text-[10px]" />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-neutral-300">
                      {formatHoldingDay(row.holding.boughtAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openSell(row)}
                        className="min-h-11 px-2 font-mono text-[10px] text-neutral-400 hover:text-amber-300 md:min-h-0"
                      >
                        Sell
                      </button>
                      <button
                        type="button"
                        onClick={() => portfolio.remove(row.holding.id)}
                        className="min-h-11 px-2 font-mono text-[10px] text-neutral-600 hover:text-loss md:min-h-0"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center font-mono text-[11px] text-neutral-600">
                    ADD A TICKER, SHARE COUNT AND BUY PRICE TO START TRACKING
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </section>
        )
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-panel px-3 py-1.5 font-mono text-[9px] text-neutral-600">
        <span>
          MY PORTFOLIO · {formatShares(portfolio.holdings.reduce((sum, row) => sum + row.quantity, 0))} SHARES ·{" "}
          {portfolio.holdings.length} LINES · YAHOO{" "}
          {quotes.data?.delayMinutes != null ? `${quotes.data.delayMinutes}M DELAY` : "DELAYED"}
        </span>
        <span className={quotes.error ? "text-loss" : "text-gain"}>
          {quotes.error ? "FEED DEGRADED" : quotes.data ? "SYS OK" : "CONNECTING"} ·{" "}
          {formatMarketState(quotes.data?.marketState)} · UPDATED {formatKlTime(quotes.updatedAt)} MYT
        </span>
      </footer>
    </div>
  );
}

const MOCK_HOLDINGS = [
  { name: "Maybank", symbol: "1155.KL", shares: "12,400", buy: "9.85", last: "10.58", value: "131,192", wt: "38.4%", pnl: "+9,052", pnlPct: "+7.4%", tone: 1 },
  { name: "Tenaga", symbol: "5347.KL", shares: "4,200", buy: "13.10", last: "13.68", value: "57,456", wt: "16.8%", pnl: "+2,436", pnlPct: "+4.4%", tone: 1 },
  { name: "CIMB Group", symbol: "1023.KL", shares: "6,800", buy: "7.42", last: "7.99", value: "54,332", wt: "15.9%", pnl: "+3,876", pnlPct: "+7.7%", tone: 1 },
  { name: "Public Bank", symbol: "1295.KL", shares: "8,100", buy: "4.62", last: "5.00", value: "40,500", wt: "11.9%", pnl: "+3,078", pnlPct: "+8.2%", tone: 1 },
  { name: "Inari Amertron", symbol: "0166.KL", shares: "9,500", buy: "2.88", last: "2.61", value: "24,795", wt: "7.3%", pnl: "-2,565", pnlPct: "-9.4%", tone: -1 },
  { name: "Genting", symbol: "3182.KL", shares: "11,200", buy: "2.18", last: "2.04", value: "22,848", wt: "6.7%", pnl: "-1,568", pnlPct: "-6.4%", tone: -1 },
] as const;

const MOCK_SLICES = [
  { label: "Banking", pct: 66, color: "#22c55e" },
  { label: "Utilities", pct: 17, color: "#38bdf8" },
  { label: "Tech", pct: 7, color: "#eab308" },
  { label: "Gaming", pct: 7, color: "#a78bfa" },
  { label: "Cash", pct: 3, color: "#fb7185" },
] as const;

function MockPortfolioPreview() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-white">My Portfolio</h2>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Saved locally · live Yahoo marks · P&amp;L vs buy price, windows vs the tape
          </p>
        </div>
        <div className="flex overflow-hidden border border-line">
          {(["1M", "3M", "6M", "YTD", "1Y", "ALL"] as const).map((key) => (
            <span
              key={key}
              className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                key === "ALL" ? "bg-gain/15 text-gain" : "text-neutral-500"
              }`}
            >
              {key}
            </span>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-4">
        <Kpi label="Total portfolio value" value="RM 341,123" />
        <Kpi label="Unrealised P&L" value="+RM 14,309" hint="+4.4%" tone={1} />
        <Kpi label="Total realised P&L" value="+RM 6,840" tone={1} />
        <Kpi label="Win rate" value="71.4%" hint="7 closed trades" tone={21} />
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
        <Kpi label="Cost basis" value="RM 326,814" />
        <Kpi label="All return" value="+RM 14,309" hint="+4.4%" tone={1} />
        <Kpi label="Today" value="+RM 1,286" hint="+0.4%" tone={1} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="border border-line bg-panel p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Weight by market value
          </h3>
          <div className="space-y-2">
            {MOCK_SLICES.map((slice) => (
              <div key={slice.label} className="flex items-center gap-3">
                <span className="w-16 font-mono text-[10px] text-neutral-500">{slice.label}</span>
                <div className="h-1.5 flex-1 bg-[#161616]">
                  <div className="h-full" style={{ width: `${slice.pct}%`, backgroundColor: slice.color }} />
                </div>
                <span className="w-10 text-right font-mono text-[10px] text-neutral-400">{slice.pct}%</span>
              </div>
            ))}
          </div>
        </section>
        <section className="border border-line bg-panel p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            All mark-to-market
          </h3>
          <div className="flex h-24 items-end gap-1">
            {[42, 48, 45, 51, 55, 52, 58, 61, 59, 64, 68, 66, 71, 74, 70, 76, 80, 78, 84, 88].map(
              (h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-gain/40" style={{ height: `${h}%` }} />
              ),
            )}
          </div>
        </section>
      </div>

      <section className="min-w-0 border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Shares</th>
                <th className="px-3 py-2 text-right">Buy px</th>
                <th className="px-3 py-2 text-right">Last</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Wt</th>
                <th className="px-3 py-2 text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {MOCK_HOLDINGS.map((row) => (
                <tr key={row.symbol}>
                  <td className="px-3 py-2">
                    <span className="block text-[13px] text-neutral-100">{row.name}</span>
                    <span className="font-mono text-[9px] text-neutral-600">{row.symbol}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-200">{row.shares}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-200">{row.buy}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-100">{row.last}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-100">{row.value}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-400">{row.wt}</td>
                  <td className={`px-3 py-2 text-right font-mono text-[12px] ${changeClass(row.tone)}`}>
                    <span className="block">{row.pnl}</span>
                    <span className="text-[10px]">{row.pnlPct}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  badge,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  badge?: "POST" | null;
  tone?: number | null;
}) {
  return (
    <div className="bg-panel px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-1 font-mono text-[15px] ${tone != null ? changeClass(tone) : "text-neutral-100"}`}>
        {value}
      </p>
      {badge ? <span className="mt-0.5 inline-block text-xs font-bold text-rose-400">{badge}</span> : null}
      {hint ? (
        <div className={`mt-0.5 font-mono text-[10px] ${typeof hint === "string" && tone != null ? changeClass(tone) : "text-zinc-400"}`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">{label}</span>
      <input
        type="number"
        step="any"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full border border-line bg-[#0a0a0a] px-2.5 font-mono text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-gain/50 md:h-8 md:text-[11px]"
      />
    </label>
  );
}

function TinyInput({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  return (
    <input
      type="number"
      step="any"
      min="0"
      defaultValue={value}
      key={value}
      onBlur={(event) => {
        const next = event.target.value;
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      className="h-11 w-full border border-line bg-[#0a0a0a] px-1.5 font-mono text-base text-neutral-100 outline-none focus:border-gain/50 md:h-7 md:w-[88px] md:text-[11px]"
    />
  );
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="min-w-0 border border-line bg-panel">
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <th className={`${tableHeadClass} text-left`}>Date</th>
              <th className={`${stickyHeadClass} text-left`}>Symbol</th>
              <th className={`${tableHeadClass} text-left`}>Type</th>
              <th className={`${tableHeadClass} text-right`}>Qty</th>
              <th className={`${tableHeadClass} text-right`}>Price</th>
              <th className={`${tableHeadClass} text-right`}>Fees</th>
              <th className={`${tableHeadClass} text-right`}>Realised P&amp;L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {transactions.map((row) => (
              <tr key={row.id} className="hover:bg-[#161616]">
                <td className={`${tableCellClass} font-mono text-neutral-300`}>
                  {formatHoldingDay(row.date)}
                </td>
                <td className={`${stickyCellClass} font-mono text-neutral-100`}>{row.symbol}</td>
                <td className={`px-3 py-2 font-mono text-[11px] uppercase ${row.type === "buy" ? "text-gain" : "text-loss"}`}>
                  {row.type}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-neutral-200">
                  {formatShares(row.quantity)}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-neutral-200">{formatPrice(row.price)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-neutral-400">{formatRinggit(row.fees)}</td>
                <td className={`px-3 py-2 font-mono text-[11px] ${changeClass(row.realizedPnl)}`}>
                  {row.type === "sell" ? formatRinggit(row.realizedPnl, true) : "—"}
                </td>
              </tr>
            ))}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center font-mono text-[11px] text-neutral-600">
                  NO FILLS YET · BUYS AND SELLS LAND HERE
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DividendTable({ rows }: { rows: ReturnType<typeof estimateDividends> }) {
  return (
    <section className="min-w-0 border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <p className="text-[11px] text-neutral-500">
          Upcoming payouts assume two distributions a year (15 Mar / 15 Sep) from the trailing yield on
          the current lot. Historical yield is the Yahoo trailing annual figure.
        </p>
      </div>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <th className={`${stickyHeadClass} text-left`}>Name</th>
              <th className={`${tableHeadClass} text-right`}>Yield</th>
              <th className={`${tableHeadClass} text-right`}>Est. annual</th>
              <th className={`${tableHeadClass} text-right`}>Next payout</th>
              <th className={`${tableHeadClass} text-left`}>Next date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.symbol} className="hover:bg-[#161616]">
                <td className={stickyCellClass}>
                  <span className="block text-neutral-100">{row.name}</span>
                  <span className="font-mono text-[9px] text-neutral-600">{row.symbol}</span>
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-neutral-200">
                  {row.yieldPct != null ? `${row.yieldPct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-neutral-200">
                  {formatRinggit(row.annual)}
                </td>
                <td className={`px-3 py-2 font-mono text-[12px] ${(row.nextPayout ?? 0) > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
                  {formatRinggit(row.nextPayout)}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-neutral-300">
                  {formatHoldingDay(row.nextDate)}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center font-mono text-[11px] text-neutral-600">
                  ADD HOLDINGS TO ESTIMATE DIVIDEND INCOME
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
