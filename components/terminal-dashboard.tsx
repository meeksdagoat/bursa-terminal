"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup } from "react-resizable-panels";
import { ChartWidget } from "@/components/chart-widget";
import { ExportMenu } from "@/components/export-menu";
import { HeaderBar } from "@/components/header-bar";
import { IntelPanel } from "@/components/intel-panel";
import { MainNav } from "@/components/main-nav";
import { NewsFeed, type NewsScope } from "@/components/news-feed";
import { PanelSplitter } from "@/components/panel-resize-handle";
import { SlideDrawer } from "@/components/slide-drawer";
import { StockPicker } from "@/components/stock-picker";
import { TickerRibbon } from "@/components/ticker-ribbon";
import { WatchlistSidebar } from "@/components/watchlist-sidebar";
import { downloadCsv, stampFilename, watchlistCsvRows } from "@/lib/export";
import { formatKlTime } from "@/lib/format";
import type {
  BnmPayload,
  CompanyNewsPayload,
  NewsPayload,
  WatchlistRow,
} from "@/lib/types";
import { useBreakpoint } from "@/lib/use-media-query";
import { entryBySymbol, findEntry, terminalHref, universe } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useMarketData } from "@/lib/use-market-data";
import { useShariahOnly } from "@/lib/use-shariah";
import { useWatchlist } from "@/lib/use-watchlist";

const BNM_REFRESH_MS = 10 * 60 * 1000;
const NEWS_REFRESH_MS = 60 * 1000;

type TerminalDashboardProps = {
  /** Ticker to chart on load, resolved from `?symbol=` by the route. */
  initialSymbol: string;
};

type CompactDrawer = "watchlist" | "news" | null;

export function TerminalDashboard({ initialSymbol }: TerminalDashboardProps) {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const watchlist = useWatchlist();
  const shariahOnly = useShariahOnly();
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newsScope, setNewsScope] = useState<NewsScope>("company");
  const [compactDrawer, setCompactDrawer] = useState<CompactDrawer>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const restoreWatchlistAfterPicker = useRef(false);

  useEffect(() => {
    setSelectedSymbol(initialSymbol);
    setNewsScope("company");
  }, [initialSymbol]);

  useEffect(() => {
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    setCompactDrawer(null);
  }, [breakpoint]);

  // The charted ticker is quoted even when it is not saved, so browsing the
  // universe still shows a live price.
  const quoteSymbols = useMemo(
    () => [...new Set([...watchlist.symbols, selectedSymbol])].sort(),
    [watchlist.symbols, selectedSymbol],
  );

  const quotes = useMarketData(quoteSymbols);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);

  const companyNews = useLiveData<CompanyNewsPayload>(
    `/api/company-news?symbol=${encodeURIComponent(selectedSymbol)}`,
    NEWS_REFRESH_MS,
  );
  const marketNews = useLiveData<NewsPayload>("/api/news", NEWS_REFRESH_MS);

  const quoteBySymbol = quotes.quoteBySymbol;

  const rows = useMemo<WatchlistRow[]>(
    () =>
      watchlist.symbols.flatMap((symbol) => {
        const entry = entryBySymbol(symbol);
        return entry ? [{ ...entry, quote: quoteBySymbol.get(symbol) ?? null }] : [];
      }),
    [watchlist.symbols, quoteBySymbol],
  );

  const selected = useMemo<WatchlistRow>(() => {
    const entry = entryBySymbol(selectedSymbol) ?? universe[0];
    return { ...entry, quote: quoteBySymbol.get(entry.symbol) ?? null };
  }, [selectedSymbol, quoteBySymbol]);

  // Picking a ticker anywhere in the terminal is a request to look at that
  // company, so the news panel follows it back to company scope.
  const selectSymbol = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      setNewsScope("company");
      router.replace(terminalHref(symbol), { scroll: false });
    },
    [router],
  );

  const handleSelectFromList = useCallback(
    (symbol: string) => {
      selectSymbol(symbol);
      setCompactDrawer(null);
    },
    [selectSymbol],
  );

  const openPicker = useCallback(() => {
    if (compactDrawer === "watchlist") {
      restoreWatchlistAfterPicker.current = true;
      setCompactDrawer(null);
    }
    setPickerOpen(true);
  }, [compactDrawer]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    if (!restoreWatchlistAfterPicker.current) return;
    restoreWatchlistAfterPicker.current = false;
    setCompactDrawer("watchlist");
  }, []);

  const closeWatchlistDrawer = useCallback(() => {
    setCompactDrawer(null);
  }, []);

  // Turning the filter on while sitting on a conventional name would leave a
  // hidden ticker charted; hop to the first still-visible watchlist name.
  useEffect(() => {
    if (!shariahOnly || selected.shariah) return;
    const next =
      rows.find((row) => row.shariah) ?? universe.find((entry) => entry.shariah);
    if (next) selectSymbol(next.symbol);
  }, [shariahOnly, selected.shariah, rows, selectSymbol]);

  const handleSearch = useCallback(
    (query: string) => {
      const match = findEntry(query, { shariahOnly });
      if (match) {
        selectSymbol(match.symbol);
        setSearchHint(null);
        setCompactDrawer(null);
        return;
      }
      setSearchHint(
        shariahOnly
          ? `No Shariah-compliant match for “${query}”`
          : `No match for “${query}” in the ${universe.length}-ticker Bursa universe`,
      );
    },
    [selectSymbol, shariahOnly],
  );

  const company = newsScope === "company";
  // The company payload can trail a ticker change by one render; holding it back
  // keeps another company's headlines from flashing under this one's heading.
  const companyPayload =
    companyNews.data?.symbol === selected.symbol ? companyNews.data : null;

  const feedError = quotes.error ?? bnm.error;

  const watchlistPane = (
    <WatchlistSidebar
      rows={rows}
      sectors={quotes.data?.sectors ?? []}
      selectedSymbol={selected.symbol}
      onSelect={handleSelectFromList}
      onRemove={watchlist.remove}
      onBrowse={openPicker}
      onClose={closeWatchlistDrawer}
      ticks={quotes.ticks}
    />
  );

  const chartPane = (
    <ChartWidget
      row={selected}
      saved={watchlist.saved(selected.symbol)}
      onToggleSave={watchlist.toggle}
      ticks={quotes.ticks}
    />
  );

  const intelPane = (
    <IntelPanel
      symbol={selected.symbol}
      companyName={selected.name}
      companyShariah={selected.shariah}
    />
  );

  const newsPane = (
    <NewsFeed
      key={company ? selected.symbol : "market"}
      payload={company ? companyPayload : marketNews.data}
      error={company ? companyNews.error : marketNews.error}
      loading={company ? companyNews.loading || companyPayload == null : marketNews.loading}
      scope={newsScope}
      onScopeChange={setNewsScope}
      companyName={selected.name}
      companySymbol={company ? selected.symbol : null}
    />
  );

  return (
    <div
      data-app-shell
      className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-terminal text-neutral-200 max-lg:touch-pan-y"
    >
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleSearch}
        active="market"
        feedStatus={quotes.status}
        ticks={quotes.ticks}
        latencyMs={quotes.latencyMs}
        actions={
          <ExportMenu
            actions={[
              {
                id: "watchlist-csv",
                label: "Watchlist CSV",
                onSelect: () =>
                  downloadCsv(
                    stampFilename("bursa-watchlist", "csv"),
                    watchlistCsvRows(
                      rows.map((row) => ({
                        symbol: row.symbol,
                        name: row.name,
                        price: row.quote?.price ?? null,
                        changePct: row.quote?.changePct ?? null,
                        volume: row.quote?.volume ?? null,
                      })),
                    ),
                  ),
              },
            ]}
          />
        }
      />

      <MainNav active="market" />

      <TickerRibbon rows={rows} ticks={quotes.ticks} onSelect={handleSelectFromList} />

      {searchHint || feedError ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint ? <span>{searchHint}</span> : null}
          {feedError ? <span className="text-loss">FEED ERROR · {feedError}</span> : null}
        </div>
      ) : null}

      {layoutReady && breakpoint === "desktop" ? (
        <DesktopWorkspace
          watchlistPane={watchlistPane}
          chartPane={chartPane}
          intelPane={intelPane}
          newsPane={newsPane}
        />
      ) : (
        <CompactWorkspace
          chartPane={chartPane}
          intelPane={intelPane}
          watchlistPane={watchlistPane}
          newsPane={newsPane}
          drawer={compactDrawer}
          onDrawer={setCompactDrawer}
        />
      )}

      <footer className="hidden h-6 shrink-0 items-center justify-between border-t border-line bg-panel px-3 font-mono text-[9px] text-neutral-600 lg:flex">
        <span>
          BURSA MALAYSIA · MAIN MARKET · YAHOO{" "}
          {quotes.data?.delayMinutes != null ? `${quotes.data.delayMinutes}M DELAY` : "DELAYED"} ·
          BNM {bnm.data?.session ?? "—"} SESSION · {rows.length}/{universe.length} TRACKED
        </span>
        <span className={feedError ? "text-loss" : "text-gain"}>
          {feedError ? "FEED DEGRADED" : quotes.data ? "SYS OK" : "CONNECTING"} ·{" "}
          {quotes.data?.marketState ?? "—"} · UPDATED {formatKlTime(quotes.updatedAt)} MYT
        </span>
      </footer>

      {pickerOpen ? (
        <StockPicker
          onClose={closePicker}
          savedSymbols={watchlist.symbols}
          onToggleSave={watchlist.toggle}
          onSelect={handleSelectFromList}
          onReset={watchlist.reset}
        />
      ) : null}
    </div>
  );
}

function DesktopWorkspace({
  watchlistPane,
  chartPane,
  intelPane,
  newsPane,
}: {
  watchlistPane: ReactNode;
  chartPane: ReactNode;
  intelPane: ReactNode;
  newsPane: ReactNode;
}) {
  return (
    <PanelGroup
      autoSaveId="bursa-terminal-layout"
      direction="horizontal"
      className="min-h-0 flex-1 overflow-hidden"
    >
      <Panel id="watchlist" defaultSize={18} minSize={15} order={1} className="flex min-h-0 flex-col overflow-hidden">
        {watchlistPane}
      </Panel>

      <PanelSplitter />

      <Panel id="main" defaultSize={57} minSize={40} order={2} className="flex min-h-0 flex-col overflow-hidden">
        <PanelGroup
          autoSaveId="bursa-terminal-chart"
          direction="vertical"
          className="h-full min-h-0"
        >
          <Panel id="chart" defaultSize={62} minSize={28} className="min-h-[250px] overflow-hidden">
            {chartPane}
          </Panel>

          <PanelSplitter direction="vertical" />

          <Panel id="intel" defaultSize={38} minSize={22} className="min-h-[200px] overflow-hidden">
            {intelPane}
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelSplitter />

      {/* Remounting per scope and ticker resets the tag filter, which is
          meaningless once the underlying set of headlines changes. */}
      <Panel
        id="news"
        defaultSize={25}
        minSize={20}
        order={3}
        className="flex min-h-0 flex-col overflow-hidden"
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {newsPane}
        </div>
      </Panel>
    </PanelGroup>
  );
}

function CompactWorkspace({
  chartPane,
  intelPane,
  watchlistPane,
  newsPane,
  drawer,
  onDrawer,
}: {
  chartPane: ReactNode;
  intelPane: ReactNode;
  watchlistPane: ReactNode;
  newsPane: ReactNode;
  drawer: CompactDrawer;
  onDrawer: (drawer: CompactDrawer) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden touch-pan-y">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y">
        <div className="overflow-hidden">{chartPane}</div>
        <div className="min-h-[52vh] border-t border-line">{intelPane}</div>
      </div>

      <nav
        className="flex shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]"
        aria-label="Terminal drawers"
      >
        <button
          type="button"
          onClick={() => onDrawer("watchlist")}
          className="min-h-11 flex-1 border-r border-line px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
        >
          Watchlist
        </button>
        <button
          type="button"
          onClick={() => onDrawer("news")}
          className="min-h-11 flex-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
        >
          News
        </button>
      </nav>

      <SlideDrawer
        open={drawer === "watchlist"}
        onClose={() => onDrawer(null)}
        side="bottom"
        title="Watchlist"
        labelledBy="watchlist-heading"
        headerClassName="max-sm:hidden"
      >
        {watchlistPane}
      </SlideDrawer>
      <SlideDrawer open={drawer === "news"} onClose={() => onDrawer(null)} side="bottom" title="News">
        {newsPane}
      </SlideDrawer>
    </div>
  );
}
