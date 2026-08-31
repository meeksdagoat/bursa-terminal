"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { BrokerageFeeCard } from "@/components/calculators/BrokerageFeeCard";
import { DividendDripCard } from "@/components/calculators/DividendDripCard";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { DCATab } from "@/components/quant/DCATab";
import type { BnmPayload, QuotesPayload } from "@/lib/types";
import { DEFAULT_QUANT_ASSET_SYMBOL } from "@/lib/quant/asset-catalog";
import { feedStatusFromQuote } from "@/lib/market-status";
import { findEntry, terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useShariahOnly } from "@/lib/use-shariah";

const BNM_REFRESH_MS = 10 * 60 * 1000;
const QUOTE_REFRESH_MS = 5 * 60 * 1000;

const CALCULATOR_TABS = [
  { id: "dca", label: "DCA / Accumulation Simulator" },
  { id: "brokerage", label: "Brokerage Fee & Stamp Duty" },
  { id: "drip", label: "Dividend Yield & DRIP Planner" },
] as const;

type CalculatorTabId = (typeof CALCULATOR_TABS)[number]["id"];

export function CalculatorsPage() {
  const router = useRouter();
  const shariahOnly = useShariahOnly();
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CalculatorTabId>("dca");
  const [symbol, setSymbol] = useState(DEFAULT_QUANT_ASSET_SYMBOL);

  const bnm = useLiveData<BnmPayload>("/api/bnm", BNM_REFRESH_MS);
  const quotes = useLiveData<QuotesPayload>("/api/quotes?symbols=1155.KL", QUOTE_REFRESH_MS);

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
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-slate-100">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleSearch}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="calculators"
        feedStatus={feedStatusFromQuote(quotes.data?.index, {
          connected: quotes.data != null,
          error: quotes.error,
          loading: quotes.loading,
        })}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="calculators" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <main className="mx-auto w-full max-w-[1400px] flex-1 p-6">
        <div className="mb-4">
          <h1 className="text-[15px] font-semibold tracking-tight text-white">
            Financial Calculators & Wealth Planning
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            DCA accumulation · Bursa contract costs · dividend reinvestment
          </p>
        </div>

        <nav
          role="tablist"
          aria-label="Calculator modules"
          className="no-scrollbar mb-4 flex shrink-0 flex-nowrap overflow-x-auto border-b border-neutral-800 bg-neutral-900"
        >
          {CALCULATOR_TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-xs transition-colors ${
                  selected
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "dca" ? <DCATab symbol={symbol} onSymbolChange={setSymbol} /> : null}
        {activeTab === "brokerage" ? <BrokerageFeeCard /> : null}
        {activeTab === "drip" ? <DividendDripCard /> : null}
      </main>
    </div>
  );
}
