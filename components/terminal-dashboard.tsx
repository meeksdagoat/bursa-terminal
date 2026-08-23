"use client";

import { useMemo, useState } from "react";
import { ChartWidget } from "@/components/chart-widget";
import { FilingsPanel } from "@/components/filings-panel";
import { HeaderBar } from "@/components/header-bar";
import { NewsFeed } from "@/components/news-feed";
import { WatchlistSidebar } from "@/components/watchlist-sidebar";
import { formatKlTime } from "@/lib/format";
import type { BnmPayload, QuotesPayload, WatchlistRow } from "@/lib/types";
import { findEntry, universe } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";

const QUOTES_REFRESH_MS = 60 * 1000;
const BNM_REFRESH_MS = 10 * 60 * 1000;

export function TerminalDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState(universe[0].symbol);
  const [searchHint, setSearchHint] = useState<string | null>(null);

  const quotes = useLiveData<QuotesPayload>("/api/quotes", QUOTES_REFRESH_MS);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);

  const rows = useMemo<WatchlistRow[]>(() => {
    const bySymbol = new Map((quotes.data?.quotes ?? []).map((quote) => [quote.symbol, quote]));
    return universe.map((entry) => ({ ...entry, quote: bySymbol.get(entry.symbol) ?? null }));
  }, [quotes.data]);

  const selected = rows.find((row) => row.symbol === selectedSymbol) ?? rows[0];

  function handleSearch(query: string) {
    const match = findEntry(query);
    if (match) {
      setSelectedSymbol(match.symbol);
      setSearchHint(null);
      return;
    }
    setSearchHint(`No match for “${query}” in the tracked Bursa universe`);
  }

  const feedError = quotes.error ?? bnm.error;

  return (
    <div className="flex h-full min-h-0 flex-col bg-terminal text-neutral-200">
      <HeaderBar bnm={bnm.data} index={quotes.data?.index ?? null} onSearch={handleSearch} />

      {searchHint || feedError ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint ? <span>{searchHint}</span> : null}
          {feedError ? <span className="text-loss">FEED ERROR · {feedError}</span> : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_260px]">
        <WatchlistSidebar
          rows={rows}
          sectors={quotes.data?.sectors ?? []}
          selectedSymbol={selected.symbol}
          onSelect={setSelectedSymbol}
        />

        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex min-h-[260px] min-w-0 flex-[1.4] flex-col">
            <ChartWidget row={selected} />
          </div>
          <div className="flex min-h-[180px] min-w-0 flex-1 flex-col border-t border-line">
            <FilingsPanel opr={bnm.data?.opr ?? null} />
          </div>
        </div>

        <NewsFeed />
      </div>

      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-line bg-panel px-3 font-mono text-[9px] text-neutral-600">
        <span>
          BURSA MALAYSIA · MAIN MARKET · YAHOO{" "}
          {quotes.data?.delayMinutes != null ? `${quotes.data.delayMinutes}M DELAY` : "DELAYED"} ·
          BNM {bnm.data?.session ?? "—"} SESSION
        </span>
        <span className={feedError ? "text-loss" : "text-gain"}>
          {feedError ? "FEED DEGRADED" : quotes.data ? "SYS OK" : "CONNECTING"} ·{" "}
          {quotes.data?.marketState ?? "—"} · UPDATED {formatKlTime(quotes.updatedAt)} MYT
        </span>
      </footer>
    </div>
  );
}
