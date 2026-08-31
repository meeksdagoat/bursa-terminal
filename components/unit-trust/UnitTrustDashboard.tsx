"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { KpiSkeleton, SparklineSkeleton, TableSkeleton } from "@/components/skeleton";
import { UnitTrustChart } from "@/components/unit-trust/UnitTrustChart";
import { UnitTrustFilter } from "@/components/unit-trust/UnitTrustFilter";
import { UnitTrustTable } from "@/components/unit-trust/UnitTrustTable";
import { changeClass, formatKlTime, formatPct } from "@/lib/format";
import { computeUnitTrustBenchmarks } from "@/lib/unit-trust/benchmarks";
import {
  DEFAULT_UNIT_TRUST_FILTERS,
  defaultUnitTrustSelection,
  filterUnitTrusts,
  type UnitTrustFilterState,
} from "@/lib/unit-trust-filters";
import type { BnmPayload } from "@/lib/types";
import type { UnitTrustApiPayload, UnitTrustFund } from "@/lib/unit-trust/types";
import { KLCI_SYMBOL, findEntry, terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useMarketData } from "@/lib/use-market-data";

const BNM_REFRESH_MS = 10 * 60 * 1000;
const UNIT_TRUST_REFRESH_MS = 60 * 60 * 1000;

export function UnitTrustDashboard() {
  const router = useRouter();
  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const quotes = useMarketData([KLCI_SYMBOL]);
  const unitTrust = useLiveData<UnitTrustApiPayload>("/api/unit-trust", UNIT_TRUST_REFRESH_MS);

  const [filters, setFilters] = useState<UnitTrustFilterState>(DEFAULT_UNIT_TRUST_FILTERS);
  const [selectedFund, setSelectedFund] = useState<UnitTrustFund | null>(null);
  const [searchHint, setSearchHint] = useState<string | null>(null);

  const funds = unitTrust.data?.funds ?? [];
  const loading = unitTrust.loading && !unitTrust.data;

  const visible = useMemo(() => filterUnitTrusts(funds, filters), [funds, filters]);

  const benchmarks = useMemo(() => computeUnitTrustBenchmarks(funds), [funds]);

  /** Default to ASB once live fund data arrives; preserve user selection across refreshes. */
  useEffect(() => {
    if (funds.length === 0) return;
    setSelectedFund((current) => {
      if (current) {
        const refreshed = funds.find((fund) => fund.id === current.id);
        if (refreshed) return refreshed;
      }
      return defaultUnitTrustSelection(funds);
    });
  }, [funds]);

  function handleHeaderSearch(query: string) {
    const match = findEntry(query);
    if (!match) {
      setSearchHint(`No ticker matched “${query.trim()}”`);
      return;
    }
    setSearchHint(null);
    router.push(terminalHref(match.symbol));
  }

  return (
    <div className="flex min-h-full flex-col touch-pan-y bg-[#0a0a0a] text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleHeaderSearch}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="unit-trust"
        feedStatus={quotes.status}
        ticks={quotes.ticks}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="unit-trust" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      {unitTrust.error && !unitTrust.data ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-loss">
          Unit trust feed unavailable: {unitTrust.error}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-3 py-4">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-white">Unit Trust Tracker</h1>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            Malaysian unit trust funds · live NAV via FIMM · ASNB, Public Mutual, AHAM, Principal,
            Eastspring &amp; Kenanga
          </p>
          {unitTrust.data?.priceDate ? (
            <p className="mt-1 font-mono text-[9px] text-neutral-600">
              FIMM price date: {unitTrust.data.priceDate}
              {unitTrust.data.source === "stale" ? " · serving cached snapshot" : ""}
            </p>
          ) : null}
        </div>

        {loading ? (
          <section className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            <SummaryCard
              label="Avg ASB/ASM distribution"
              value={formatPct(benchmarks.avgAsbDistributionPct)}
              hint="Fixed-price ASNB funds (1Y yield proxy)"
              tone={benchmarks.avgAsbDistributionPct}
            />
            <SummaryCard
              label="Top variable fund (1Y)"
              value={benchmarks.topVariableFund?.shortName ?? "—"}
              hint={
                benchmarks.topVariableFund?.return1yPct != null
                  ? `${formatPct(benchmarks.topVariableFund.return1yPct)} · ${benchmarks.topVariableFund.provider}`
                  : "No variable funds"
              }
              tone={benchmarks.topVariableFund?.return1yPct}
            />
            <SummaryCard
              label="Funds tracked"
              value={String(benchmarks.totalTracked)}
              hint="Live NAV from FIMM daily bulletin"
            />
          </section>
        )}

        <UnitTrustFilter filters={filters} resultCount={visible.length} onChange={setFilters} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {loading ? (
            <>
              <section className="min-w-0 border border-line bg-[#121212]">
                <div className="border-b border-line px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                    Loading fund table…
                  </p>
                </div>
                <TableSkeleton rows={10} cols={6} />
              </section>
              <section className="flex min-h-[320px] flex-col border border-line bg-[#121212] p-3">
                <SparklineSkeleton />
              </section>
            </>
          ) : (
            <>
              <UnitTrustTable
                funds={visible}
                selectedFund={selectedFund}
                onSelectFund={setSelectedFund}
              />
              <UnitTrustChart key={selectedFund?.id ?? "none"} fund={selectedFund} />
            </>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-[#121212] px-3 py-1.5 font-mono text-[9px] text-neutral-600">
        <span>
          UNIT TRUST TRACKER · {benchmarks.totalTracked} FUNDS · FIMM · ASNB · PUBLIC MUTUAL · AHAM
        </span>
        <span className="text-gain">
          {unitTrust.updatedAt
            ? `LIVE · UPDATED ${formatKlTime(unitTrust.updatedAt)} MYT`
            : `REFRESHING · ${formatKlTime(Date.now())} MYT`}
        </span>
      </footer>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: number | null;
}) {
  return (
    <div className="bg-[#121212] px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={`mt-1 font-mono text-[15px] font-semibold ${tone != null ? changeClass(tone) : "text-neutral-100"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[9px] text-neutral-600">{hint}</p>
    </div>
  );
}
