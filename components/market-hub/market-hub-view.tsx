"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DerivativesPanel } from "@/components/market-hub/DerivativesPanel";
import { IndicesGrid } from "@/components/market-hub/IndicesGrid";
import { ReitEtfExplorer } from "@/components/market-hub/ReitEtfExplorer";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { formatKlTime } from "@/lib/format";
import { feedStatusFromQuote } from "@/lib/market-status";
import type { BnmPayload, MarketHubPayload, QuotesPayload } from "@/lib/types";
import { findEntry, terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useShariahOnly } from "@/lib/use-shariah";

const HUB_REFRESH_MS = 60 * 1000;
const BNM_REFRESH_MS = 10 * 60 * 1000;

export function MarketHubView() {
  const router = useRouter();
  const shariahOnly = useShariahOnly();
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const hub = useLiveData<MarketHubPayload>("/api/market-hub", HUB_REFRESH_MS);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const quotes = useLiveData<QuotesPayload>("/api/quotes?symbols=1155.KL", HUB_REFRESH_MS);

  const handleSearch = useCallback(
    (query: string) => {
      const match = findEntry(query, { shariahOnly });
      if (match) {
        setSearchHint(null);
        router.push(terminalHref(match.symbol));
        return;
      }
      setSearchHint(`No ticker matched “${query.trim()}”`);
    },
    [router, shariahOnly],
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0d0d0d] text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleSearch}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="market-hub"
        feedStatus={feedStatusFromQuote(quotes.data?.index, {
          connected: quotes.data != null,
          error: quotes.error,
          loading: quotes.loading,
        })}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="market-hub" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-3 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-white">Market Hub</h1>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                Indices · BMD derivatives · REITs / ETFs
              </p>
            </div>
            <label className="flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm">
              <span className="sr-only">Filter Market Hub</span>
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter sectors, REITs, warrants…"
                className="min-h-11 w-full border border-neutral-800 bg-[#0a0a0a] px-2 font-mono text-[12px] text-neutral-100 placeholder:text-neutral-600 md:min-h-9"
              />
            </label>
          </div>

          {hub.error && !hub.data ? (
            <p className="border border-neutral-800 px-3 py-4 font-mono text-[11px] text-neutral-500">
              MARKET HUB FEED UNAVAILABLE · {hub.error}
            </p>
          ) : (
            <>
              <IndicesGrid
                benchmarks={hub.data?.benchmarks ?? []}
                sectors={hub.data?.sectors ?? []}
                filter={filter}
                loading={hub.loading && !hub.data}
              />
              <DerivativesPanel
                derivatives={hub.data?.derivatives ?? []}
                warrants={hub.data?.warrants ?? []}
                filter={filter}
                loading={hub.loading && !hub.data}
              />
              {hub.data ? (
                <ReitEtfExplorer reits={hub.data.reits} etfs={hub.data.etfs} filter={filter} />
              ) : null}
            </>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-col gap-0.5 border-t border-neutral-800 bg-[#0a0a0a] px-3 py-1.5 font-mono text-[9px] leading-tight text-neutral-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
        <span>MARKET HUB · FBM PROXIES · BMD FCPO · M-REIT / ETF</span>
        <span className={hub.error ? "text-loss" : "text-gain"}>
          {hub.error ? "FEED DEGRADED" : hub.data ? "SYS OK" : "CONNECTING"} · UPDATED{" "}
          {formatKlTime(hub.updatedAt)} MYT
        </span>
      </footer>
    </div>
  );
}
