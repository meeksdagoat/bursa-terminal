"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BacktestTab } from "@/components/quant/BacktestTab";
import { CustomStrategiesProvider } from "@/components/quant/CustomStrategiesProvider";
import { MonteCarloTab } from "@/components/quant/MonteCarloTab";
import { PairsTrading } from "@/components/quant/PairsTrading";
import { PortfolioFrontierTab } from "@/components/quant/PortfolioFrontierTab";
import { RegimeClassifier } from "@/components/quant/RegimeClassifier";
import { VaREngine } from "@/components/quant/VaREngine";
import { WarrantPricer } from "@/components/quant/WarrantPricer";
import { CorrelationEngine } from "@/components/quant-hub/CorrelationEngine";
import { FactorScoreGrid } from "@/components/quant-hub/FactorScoreGrid";
import {
  LearnQuantModal,
  QuantTabToolbar,
  type LearnQuantTabId,
} from "@/components/quant-hub/LearnQuantModal";
import { QuantExportProvider, RegisteredExportToolbar } from "@/components/quant-hub/QuantExportContext";
import { QuantLearnModal, type NewQuantLearnId } from "@/components/quant/QuantLearnModal";
import { HeaderBar } from "@/components/header-bar";
import { MainNav } from "@/components/main-nav";
import { ResponsiveSplit } from "@/components/responsive-split";
import { formatKlTime } from "@/lib/format";
import type { QuantHubPayload } from "@/lib/quant/types";
import { formatFactorTargetCategories } from "@/lib/quant/sector-relevance";
import { QUANT_FACTOR_OPTIONS } from "@/lib/quant/types";
import { feedStatusFromQuote } from "@/lib/market-status";
import type { BnmPayload, QuotesPayload } from "@/lib/types";
import { findEntry, terminalHref, entryBySymbol } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { useShariahOnly } from "@/lib/use-shariah";

const HUB_REFRESH_MS = 5 * 60 * 1000;
const BNM_REFRESH_MS = 10 * 60 * 1000;

const QUANT_TABS = [
  { id: "backtest", label: "Historical Backtest Engine" },
  { id: "monte-carlo", label: "Monte Carlo Simulator" },
  { id: "frontier", label: "Markowitz Efficient Frontier" },
  { id: "var", label: "Value at Risk (VaR)" },
  { id: "warrant", label: "Warrant Pricer (Black-Scholes)" },
  { id: "pairs", label: "Statistical Arbitrage (Pairs)" },
  { id: "regime", label: "HMM Regime Classification" },
  { id: "factors", label: "Factor Signals & Alt Data" },
] as const;

type QuantTabId = (typeof QUANT_TABS)[number]["id"];

export function QuantHub() {
  const router = useRouter();
  const shariahOnly = useShariahOnly();
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [targetSymbol, setTargetSymbol] = useState("1155.KL");
  const [learnTab, setLearnTab] = useState<LearnQuantTabId | null>(null);
  const [strategyLearnTab, setStrategyLearnTab] = useState<NewQuantLearnId | null>(null);
  const [activeTab, setActiveTab] = useState<QuantTabId>("backtest");
  const tabListRef = useRef<HTMLElement>(null);

  const quant = useLiveData<QuantHubPayload>("/api/quant-hub", HUB_REFRESH_MS);
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

  const factorOptions = quant.data?.factorOptions ?? QUANT_FACTOR_OPTIONS;

  useEffect(() => {
    const node = tabListRef.current;
    if (!node) return;

    function onWheel(event: WheelEvent) {
      if (event.deltaY === 0) return;
      event.preventDefault();
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0d0d0d] text-neutral-200">
      <HeaderBar
        bnm={bnm.data}
        index={quotes.data?.index ?? null}
        onSearch={handleSearch}
        searchPlaceholder="Search a ticker to open Bursa MY — Maybank 1155.KL"
        active="quant-hub"
        feedStatus={feedStatusFromQuote(quotes.data?.index, {
          connected: quotes.data != null,
          error: quotes.error,
          loading: quotes.loading,
        })}
        latencyMs={quotes.latencyMs}
      />
      <MainNav active="quant-hub" />

      {searchHint ? (
        <p className="border-b border-line bg-[#1a1208] px-3 py-1 font-mono text-[10px] text-amber-400">
          {searchHint}
        </p>
      ) : null}

      <CustomStrategiesProvider>
        <QuantExportProvider>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-3 py-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-white">Quant Hub</h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Multi-factor signals · alternative data · simulation workbench
            </p>
          </div>

          <nav
            ref={tabListRef}
            role="tablist"
            aria-label="Quant Hub modules"
            className="flex w-full min-w-0 items-center gap-1 overflow-x-auto scroll-smooth whitespace-nowrap border-b border-neutral-800 bg-neutral-900 pb-1 scrollbar-none"
            onWheel={(event) => {
              if (event.deltaY !== 0) {
                event.currentTarget.scrollLeft += event.deltaY;
              }
            }}
          >
            {QUANT_TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-xs transition-colors ${
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

          {quant.error ? (
            <p className="rounded border border-loss/30 bg-loss/10 px-3 py-2 font-mono text-[10px] text-loss">
              {quant.error}
            </p>
          ) : null}

          {quant.data?.errors.length ? (
            <p className="rounded border border-amber-400/20 bg-amber-400/5 px-3 py-2 font-mono text-[10px] text-amber-400">
              Partial data: {quant.data.errors.slice(0, 3).join(" · ")}
            </p>
          ) : null}

          <div className="min-h-0 flex-1">
            {activeTab === "factors" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Factor Signals & Alt Data"
                  learnLabel="Signals"
                  onLearn={() => setLearnTab("factors")}
                  trailing={<RegisteredExportToolbar />}
                />
                <FactorSignalsTab
                  quant={quant}
                  factorOptions={factorOptions}
                  targetSymbol={targetSymbol}
                  onSymbolChange={setTargetSymbol}
                />
              </div>
            ) : null}

            {activeTab === "monte-carlo" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Monte Carlo Simulator"
                  learnLabel="Monte Carlo"
                  onLearn={() => setLearnTab("monte-carlo")}
                  trailing={<RegisteredExportToolbar />}
                />
                <MonteCarloTab symbol={targetSymbol} onSymbolChange={setTargetSymbol} />
              </div>
            ) : null}

            {activeTab === "backtest" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Historical Backtest Engine"
                  learnLabel="Backtesting"
                  onLearn={() => setLearnTab("backtest")}
                  trailing={<RegisteredExportToolbar />}
                />
                <BacktestTab symbol={targetSymbol} onSymbolChange={setTargetSymbol} />
              </div>
            ) : null}

            {activeTab === "frontier" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Markowitz Efficient Frontier"
                  learnLabel="Frontier"
                  onLearn={() => setLearnTab("frontier")}
                />
                <PortfolioFrontierTab />
              </div>
            ) : null}

            {activeTab === "var" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Value at Risk (VaR)"
                  learnLabel="VaR"
                  onLearn={() => setStrategyLearnTab("var")}
                />
                <VaREngine symbol={targetSymbol} onSymbolChange={setTargetSymbol} />
              </div>
            ) : null}

            {activeTab === "warrant" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Warrant Pricer (Black-Scholes)"
                  learnLabel="Warrant Pricer"
                  onLearn={() => setStrategyLearnTab("warrant")}
                />
                <WarrantPricer symbol={targetSymbol} onSymbolChange={setTargetSymbol} />
              </div>
            ) : null}

            {activeTab === "pairs" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="Statistical Arbitrage (Pairs)"
                  learnLabel="Pairs Trading"
                  onLearn={() => setStrategyLearnTab("pairs")}
                />
                <PairsTrading symbol={targetSymbol} onSymbolChange={setTargetSymbol} />
              </div>
            ) : null}

            {activeTab === "regime" ? (
              <div className="flex flex-col gap-3">
                <QuantTabToolbar
                  title="HMM Regime Classification"
                  learnLabel="HMM Regimes"
                  onLearn={() => setStrategyLearnTab("regime")}
                />
                <RegimeClassifier symbol={targetSymbol} onSymbolChange={setTargetSymbol} />
              </div>
            ) : null}
          </div>
        </div>

        <footer className="mt-auto shrink-0 border-t border-line bg-panel px-3 py-1.5 font-mono text-[9px] text-neutral-600">
          Quant Hub · {formatKlTime(Date.now())} MYT
          {quant.updatedAt ? ` · refreshed ${formatKlTime(quant.updatedAt)}` : ""}
          {quant.data?.factors.length
            ? ` · ${quant.data.factors.filter((factor) => factor.status === "live").length}/${quant.data.factors.length} live`
            : ""}
        </footer>
        </div>
        </QuantExportProvider>
      </CustomStrategiesProvider>

      <LearnQuantModal
        tab={learnTab}
        open={learnTab !== null}
        onClose={() => setLearnTab(null)}
      />
      <QuantLearnModal
        tab={strategyLearnTab}
        open={strategyLearnTab !== null}
        onClose={() => setStrategyLearnTab(null)}
      />
    </div>
  );
}

function FactorSignalsTab({
  quant,
  factorOptions,
  targetSymbol,
  onSymbolChange,
}: {
  quant: ReturnType<typeof useLiveData<QuantHubPayload>>;
  factorOptions: QuantHubPayload["factorOptions"];
  targetSymbol: string;
  onSymbolChange: (symbol: string) => void;
}) {
  const targetEntry = entryBySymbol(targetSymbol);
  const targetSector = targetEntry?.sector ?? "Unknown";

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Factor Score Overview
          </h2>
          <span className="font-mono text-[9px] text-neutral-600">
            Scale −100 bearish → +100 bullish
          </span>
        </div>
        <FactorScoreGrid
          factors={quant.data?.factors ?? []}
          targetSymbol={targetSymbol}
          targetSector={targetSector}
          loading={quant.loading}
        />
      </section>

      <div className="min-h-[420px]">
        <ResponsiveSplit
          autoSaveId="quant-hub-split"
          left={{
            id: "correlation",
            label: "Correlation",
            defaultSize: 58,
            minSize: 35,
            content: (
              <CorrelationEngine
                factorOptions={factorOptions}
                symbol={targetSymbol}
                onSymbolChange={onSymbolChange}
              />
            ),
          }}
          right={{
            id: "guide",
            label: "Factors",
            defaultSize: 42,
            minSize: 25,
            content: <QuantFactorGuide factors={quant.data?.factors ?? []} />,
          }}
        />
      </div>
    </div>
  );
}

function QuantFactorGuide({
  factors,
}: {
  factors: QuantHubPayload["factors"];
}) {
  return (
    <section className="flex h-full min-h-[320px] flex-col gap-3 overflow-y-auto rounded border border-neutral-800 bg-[#0d0d0d] p-3">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Factor Methodology
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          Six orthogonal signals combining alternative data, institutional flows, macro rates and
          market breadth. Scores are scaled to a −100…+100 terminal gauge.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {factors.map((factor) => (
          <article key={factor.id} className="rounded border border-neutral-800 bg-[#111111] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300">
                {factor.label}
              </h3>
              <span className="font-mono text-[10px] text-neutral-500">{factor.status}</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{factor.summary}</p>
            <p className="mt-2 font-mono text-[9px] text-neutral-600">
              Targets: {formatFactorTargetCategories(factor.id)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
