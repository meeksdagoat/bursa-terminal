"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { ScreenerFilters } from "@/components/ScreenerFilters";
import { ScreenerTable } from "@/components/ScreenerTable";
import { TableSkeleton } from "@/components/skeleton";
import type { BnmPayload, ScreenerPayload } from "@/lib/types";
import {
  applyScreenerFilters,
  defaultScreenerFilters,
  sectorOptions,
  sortScreenerRows,
  type ScreenerSortKey,
} from "@/lib/screener-filters";
import { KLCI_SYMBOL, findEntry, terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useMarketData } from "@/lib/use-market-data";
import { useShariahOnly } from "@/lib/use-shariah";

const SCREENER_REFRESH_MS = 5 * 60 * 1000;
const BNM_REFRESH_MS = 10 * 60 * 1000;

export function ScreenerPage() {
  const router = useRouter();
  const shariahOnly = useShariahOnly();
  const screener = useLiveData<ScreenerPayload>("/api/screener", SCREENER_REFRESH_MS);
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const quotes = useMarketData([KLCI_SYMBOL]);

  const [filters, setFilters] = useState(() => defaultScreenerFilters(shariahOnly, 80));
  const [sortKey, setSortKey] = useState<ScreenerSortKey>("dividendYieldPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchHint, setSearchHint] = useState<string | null>(null);

  const peBoundMax = screener.data?.peBounds.max ?? 80;
  const yieldBoundMax = screener.data?.yieldBounds.max ?? 8;
  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      peMax: Math.min(filters.peMax, peBoundMax),
      yieldMin: Math.min(filters.yieldMin, yieldBoundMax),
    }),
    [filters, peBoundMax, yieldBoundMax],
  );

  const groups = useMemo(
    () => sectorOptions(screener.data?.sectors ?? []),
    [screener.data?.sectors],
  );

  const visible = useMemo(() => {
    const rows = screener.data?.rows ?? [];
    const filtered = applyScreenerFilters(rows, effectiveFilters, groups, peBoundMax);
    return sortScreenerRows(filtered, sortKey, sortDir);
  }, [screener.data?.rows, effectiveFilters, groups, peBoundMax, sortKey, sortDir]);

  function handleSort(key: ScreenerSortKey) {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" || key === "symbol" || key === "sector" ? "asc" : "desc");
  }

  function handleHeaderSearch(query: string) {
    const match = findEntry(query);
    if (!match) {
      setSearchHint(`No ticker matched “${query.trim()}”`);
      return;
    }
    setSearchHint(null);
    router.push(terminalHref(match.symbol));
  }

  const pending = screener.loading && !screener.data;

  return (
    <div className="flex min-h-full flex-col touch-pan-y bg-terminal text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleHeaderSearch}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="screener"
        feedStatus={quotes.status}
        ticks={quotes.ticks}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="screener" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-3 py-4">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-white">Stock screener</h1>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Full Bursa roster · Yahoo P/E, yield, market cap and ROE
            {screener.data
              ? ` · ${screener.data.covered.toLocaleString()}/${screener.data.universe.toLocaleString()} quoted`
              : ""}
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <ScreenerFilters
          filters={effectiveFilters}
          peBoundMax={peBoundMax}
          yieldBoundMax={yieldBoundMax}
          sectors={groups}
          resultCount={visible.length}
          universeCount={screener.data?.universe ?? 0}
          onChange={setFilters}
          onReset={() => setFilters(defaultScreenerFilters(false, peBoundMax))}
        />

        {screener.error && !screener.data ? (
          <p className="flex-1 border border-line px-3 py-4 font-mono text-[11px] text-neutral-500">
            SCREENER FEED UNAVAILABLE · {screener.error}
          </p>
        ) : pending ? (
          <div className="min-w-0 flex-1 border border-line bg-panel">
            <TableSkeleton rows={12} cols={8} />
          </div>
        ) : (
          <ScreenerTable
            rows={visible}
            sortKey={sortKey}
            sortDir={sortDir}
            query={effectiveFilters.query}
            onQuery={(query) => setFilters((current) => ({ ...current, query }))}
            onSort={handleSort}
          />
        )}
        </div>
      </div>
    </div>
  );
}
