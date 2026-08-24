"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { EconomyDesk } from "@/components/economy-desk";
import { HeadlineList } from "@/components/headline-list";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { PoliticsDesk } from "@/components/politics-desk";
import type { HeadlineCategory } from "@/lib/categories";
import { formatKlTime } from "@/lib/format";
import type {
  BnmPayload,
  EconomyPayload,
  HeadlinesPayload,
  OfficialPayload,
  QuotesPayload,
} from "@/lib/types";
import { feedStatusFromQuote } from "@/lib/market-status";
import { heatmapSymbols } from "@/lib/sectors";
import { findEntry, terminalHref, universe } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useShariahOnly } from "@/lib/use-shariah";

const QUOTES_REFRESH_MS = 60 * 1000;
const BNM_REFRESH_MS = 10 * 60 * 1000;
const HEADLINES_REFRESH_MS = 5 * 60 * 1000;

type HomeOverviewProps = {
  category: HeadlineCategory;
};

export function HomeOverview({ category }: HomeOverviewProps) {
  const router = useRouter();
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const shariahOnly = useShariahOnly();

  const quotesUrl =
    category === "my-economy"
      ? `/api/quotes?symbols=${encodeURIComponent(heatmapSymbols().join(","))}`
      : "/api/quotes?symbols=1155.KL";
  const quotes = useLiveData<QuotesPayload>(quotesUrl, QUOTES_REFRESH_MS);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const headlines = useLiveData<HeadlinesPayload>(
    `/api/headlines?category=${category}`,
    HEADLINES_REFRESH_MS,
  );
  const economy = useLiveData<EconomyPayload>("/api/economy", BNM_REFRESH_MS);
  const official = useLiveData<OfficialPayload>("/api/official", HEADLINES_REFRESH_MS);

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
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden touch-pan-y bg-terminal text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleSearch}
        searchPlaceholder="Search a ticker to open the terminal — Maybank 1155.KL"
        active={category}
        feedStatus={feedStatusFromQuote(quotes.data?.index, {
          connected: quotes.data != null,
          error: quotes.error,
          loading: quotes.loading,
        })}
        latencyMs={quotes.latencyMs}
      />

      <MainNav active={category} />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {category === "my-economy" ? (
          <EconomyDesk
            bnm={bnm.data}
            economy={economy.data}
            economyError={economy.error}
            sectors={quotes.data?.sectors ?? []}
            headlines={headlines.data}
            headlinesError={headlines.error}
            headlinesLoading={headlines.loading}
          />
        ) : category === "my-politics" ? (
          <PoliticsDesk
            official={official.data}
            officialError={official.error}
            officialLoading={official.loading}
            headlines={headlines.data}
            headlinesError={headlines.error}
            headlinesLoading={headlines.loading}
          />
        ) : (
          <HeadlineList
            category={category}
            payload={headlines.data}
            error={headlines.error}
            loading={headlines.loading}
          />
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-panel px-3 py-1.5 font-mono text-[9px] text-neutral-600">
        <span>
          BURSA MALAYSIA · NEWS DESK · YAHOO{" "}
          {quotes.data?.delayMinutes != null ? `${quotes.data.delayMinutes}M DELAY` : "DELAYED"} ·
          BNM {bnm.data?.session ?? "—"} SESSION · DOSM CPI · GOOGLE NEWS WIRE
        </span>
        <span className={quotes.error ? "text-loss" : "text-gain"}>
          {quotes.error ? "FEED DEGRADED" : quotes.data ? "SYS OK" : "CONNECTING"} ·{" "}
          {quotes.data?.marketState ?? "—"} · UPDATED {formatKlTime(quotes.updatedAt)} MYT
        </span>
      </footer>
    </div>
  );
}
