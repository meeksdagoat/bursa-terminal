"use client";

import { lazy, memo, Suspense, useState } from "react";
import { PanelSkeleton } from "@/components/skeleton";
import { sectorPeers } from "@/lib/universe";
import { useShariahOnly } from "@/lib/use-shariah";

const CorporatePerformance = lazy(() =>
  import("@/components/corporate-performance").then((mod) => ({ default: mod.CorporatePerformance })),
);
const StockDeepDivePanel = lazy(() =>
  import("@/components/StockDeepDivePanel").then((mod) => ({ default: mod.StockDeepDivePanel })),
);
const MajorEvents = lazy(() =>
  import("@/components/major-events").then((mod) => ({ default: mod.MajorEvents })),
);
const BursaAnnouncementsPanel = lazy(() =>
  import("@/components/BursaAnnouncementsPanel").then((mod) => ({
    default: mod.BursaAnnouncementsPanel,
  })),
);
const WarrantsPanel = lazy(() =>
  import("@/components/WarrantsPanel").then((mod) => ({ default: mod.WarrantsPanel })),
);
const TechnicalGauge = lazy(() =>
  import("@/components/technical-gauge").then((mod) => ({ default: mod.TechnicalGauge })),
);

type Tab = "technicals" | "performance" | "peers" | "events" | "filings" | "warrants";

type IntelPanelProps = {
  symbol: string;
  companyName: string;
  /** Whether the charted company is on the curated Shariah list. */
  companyShariah: boolean;
};

function TabFallback() {
  return <PanelSkeleton />;
}

function IntelPanelInner({ symbol, companyName, companyShariah }: IntelPanelProps) {
  const [tab, setTab] = useState<Tab>("performance");
  const shariahOnly = useShariahOnly();
  const filingsBlocked = shariahOnly && !companyShariah;

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <div className="no-scrollbar flex min-h-11 shrink-0 items-center overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-none snap-x border-b border-line md:h-7 md:min-h-0">
        <TabButton
          active={tab === "performance"}
          onClick={() => setTab("performance")}
          label="Corporate Performance"
          shortLabel="Performance"
        />
        <TabButton
          active={tab === "peers"}
          onClick={() => setTab("peers")}
          label="Peer Comparison"
          shortLabel="Peers"
        />
        <TabButton
          active={tab === "events"}
          onClick={() => setTab("events")}
          label="Major Events & News"
          shortLabel="Events"
        />
        <TabButton
          active={tab === "filings"}
          onClick={() => setTab("filings")}
          label="Announcements"
          shortLabel="Anns"
        />
        <TabButton
          active={tab === "warrants"}
          onClick={() => setTab("warrants")}
          label="Warrants"
          shortLabel="Warrants"
        />
        <TabButton
          active={tab === "technicals"}
          onClick={() => setTab("technicals")}
          label="Technical Analysis"
          shortLabel="Tech"
        />

        <span className="ml-auto hidden pr-2 font-mono text-[9px] text-neutral-700 md:inline">
          {tab === "technicals"
            ? `1Y DAILY · ${symbol}`
            : tab === "performance"
              ? `REPORTED · ${symbol}`
              : tab === "peers"
                ? `YAHOO LIVE · ${symbol}`
                : tab === "events"
                  ? `TIMELINE · ${symbol}`
                  : tab === "warrants"
                    ? `SW · ${symbol}`
                    : filingsBlocked
                      ? "HIDDEN BY SHARIAH FILTER"
                      : `LIVE · ${symbol}`}
        </span>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
        <Suspense fallback={<TabFallback />}>
          {tab === "technicals" ? (
            <TechnicalGauge symbol={symbol} companyName={companyName} />
          ) : tab === "performance" ? (
            <CorporatePerformance key={symbol} symbol={symbol} companyName={companyName} />
          ) : tab === "peers" ? (
            <StockDeepDivePanel
              key={symbol}
              currentTicker={symbol}
              peerTickers={sectorPeers(symbol, 4)}
            />
          ) : tab === "events" ? (
            <MajorEvents key={symbol} symbol={symbol} companyName={companyName} />
          ) : tab === "warrants" ? (
            <WarrantsPanel key={symbol} symbol={symbol} companyName={companyName} />
          ) : filingsBlocked ? (
            <p className="px-2.5 py-3 font-mono text-[10px] leading-relaxed text-neutral-600">
              {companyName.toUpperCase()} IS NOT ON THE SHARIAH LIST · ANNOUNCEMENTS HIDDEN WHILE THE
              SHARIAH FILTER IS ON
            </p>
          ) : (
            <BursaAnnouncementsPanel key={symbol} symbol={symbol} companyName={companyName} />
          )}
        </Suspense>
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  label,
  shortLabel,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full min-h-11 shrink-0 snap-start border-r border-line px-3 text-[10px] font-semibold uppercase tracking-[0.12em] md:min-h-0 ${
        active ? "bg-[#1a1a1a] text-gain" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <span className="md:hidden">{shortLabel}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export const IntelPanel = memo(IntelPanelInner);
