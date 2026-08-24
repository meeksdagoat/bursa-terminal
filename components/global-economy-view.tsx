"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { GlobalEconomyDesk } from "@/components/global-economy-desk";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { formatKlTime } from "@/lib/format";
import { feedStatusFromQuote } from "@/lib/market-status";
import type { BnmPayload, GlobalEconomyPayload, HeadlinesPayload, QuotesPayload } from "@/lib/types";
import { findEntry, terminalHref, universe } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useShariahOnly } from "@/lib/use-shariah";

const QUOTES_REFRESH_MS = 60 * 1000;
const BNM_REFRESH_MS = 10 * 60 * 1000;
const HEADLINES_REFRESH_MS = 5 * 60 * 1000;

export function GlobalEconomyView() {
  const router = useRouter();
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const shariahOnly = useShariahOnly();

  const quotes = useLiveData<QuotesPayload>("/api/quotes?symbols=1155.KL", QUOTES_REFRESH_MS);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const headlines = useLiveData<HeadlinesPayload>(
    "/api/headlines?category=global-economy",
    HEADLINES_REFRESH_MS,
  );
  const economy = useLiveData<GlobalEconomyPayload>("/api/global-economy", BNM_REFRESH_MS);

  const handleSearch = useCallback(
    (query: string) => {
      const match = findEntry(query, { shariahOnly });
      if (match) {
        setSearchHint(null);
        router.push(terminalHref(match.symbol));
        return;
      }
      setSearchHint(
        shariahOnly
          ? `No Shariah-compliant match for “${query}”`
          : `No match for “${query}” in the ${universe.length}-ticker Bursa universe`,
      );
    },
    [router, shariahOnly],
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-terminal text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleSearch}
        searchPlaceholder="Search a ticker to open the terminal — Maybank 1155.KL"
        active="global-economy"
        feedStatus={feedStatusFromQuote(quotes.data?.index, {
          connected: quotes.data != null,
          error: quotes.error,
          loading: quotes.loading,
        })}
        latencyMs={quotes.latencyMs}
      />

      <MainNav active="global-economy" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <GlobalEconomyDesk
          snapshot={economy.data}
          snapshotError={economy.error}
          headlines={headlines.data}
          headlinesError={headlines.error}
          headlinesLoading={headlines.loading}
        />
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-panel px-3 py-1.5 font-mono text-[9px] text-neutral-600">
        <span>
          GLOBAL MACRO · NY FED EFFR · ECB DFR · YAHOO ^TNX ^GSPC ^NDX BZ=F GC=F · GOOGLE NEWS WIRE
        </span>
        <span className={quotes.error || economy.error ? "text-loss" : "text-gain"}>
          {quotes.error || economy.error ? "FEED DEGRADED" : quotes.data ? "SYS OK" : "CONNECTING"} ·{" "}
          {quotes.data?.marketState ?? "—"} · UPDATED {formatKlTime(quotes.updatedAt)} MYT
        </span>
      </footer>
    </div>
  );
}
