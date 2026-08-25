"use client";

import { useState } from "react";
import { Panel, PanelGroup } from "react-resizable-panels";
import { GLOBAL_ECONOMY_TAGS } from "@/lib/categories";
import { GlobalEconomyTab } from "@/components/GlobalEconomyTab";
import { GlobalEventCalendar } from "@/components/GlobalEventCalendar";
import { HeadlineList } from "@/components/headline-list";
import { Indicator } from "@/components/economy-desk";
import { PanelSplitter } from "@/components/panel-resize-handle";
import { SlideDrawer } from "@/components/slide-drawer";
import { formatKlDate, formatOpr } from "@/lib/format";
import type { BnmPayload, EconomyPayload, GlobalEconomyPayload, HeadlinesPayload } from "@/lib/types";
import { useBreakpoint } from "@/lib/use-media-query";

type GlobalEconomyDeskProps = {
  snapshot: GlobalEconomyPayload | null;
  snapshotError: string | null;
  bnm: BnmPayload | null;
  malaysia: EconomyPayload | null;
  headlines: HeadlinesPayload | null;
  headlinesError: string | null;
  headlinesLoading: boolean;
};

type GlobalTab = "banks" | "markets" | "news";
type TabletDrawer = "banks" | "news" | null;

export function GlobalEconomyDesk({
  snapshot,
  snapshotError,
  bnm,
  malaysia,
  headlines,
  headlinesError,
  headlinesLoading,
}: GlobalEconomyDeskProps) {
  const breakpoint = useBreakpoint();
  const [tab, setTab] = useState<GlobalTab>("markets");
  const [drawer, setDrawer] = useState<TabletDrawer>(null);
  const rates = snapshot?.rates ?? [];

  const banks = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-panel">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Central Banks
        </h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">Fed · ECB · BOJ · PBOC</p>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-px bg-neutral-800">
          {(rates.length > 0 ? rates : EMPTY_RATES).map((rate) => (
            <Indicator
              key={rate.id}
              label={`${rate.label} (${rate.region})`}
              value={formatOpr(rate.rate)}
              hint={`${rate.instrument}${rate.asOf ? ` · ${formatKlDate(rate.asOf)}` : ""}`}
              change={
                rate.changeBps == null
                  ? null
                  : rate.changeBps === 0
                    ? "UNCH"
                    : `${rate.changeBps > 0 ? "+" : ""}${rate.changeBps}bps`
              }
              live={rate.source === "ny-fed" || rate.source === "ecb"}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const marketBoard = (
    <div className="flex h-full min-h-[200px] min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Global Economy
          </h2>
          <span className="inline-flex items-center gap-1 rounded-sm border border-gain/40 bg-gain/10 px-1.5 py-0.5 font-mono text-[8px] tracking-wider text-gain">
            <span className="relative inline-flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            STREAMING
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          US 10Y · S&P 500 · Nasdaq 100 · Brent · Gold
        </p>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-hidden bg-[#0a0a0a]">
        <GlobalEconomyTab
          snapshot={snapshot}
          snapshotError={snapshotError}
          bnm={bnm}
          malaysia={malaysia}
        />
      </div>
    </div>
  );

  const calendar = <GlobalEventCalendar />;

  const news = (
    <HeadlineList
      category="global-economy"
      payload={headlines}
      error={headlinesError}
      loading={headlinesLoading}
      pinnedTags={GLOBAL_ECONOMY_TAGS}
      heading="Global News"
    />
  );

  const mainSplit = (
    <PanelGroup
      autoSaveId="bursa-global-economy-chart-v2"
      direction="vertical"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <Panel
        id="global-markets"
        defaultSize={58}
        minSize={30}
        className="overflow-hidden"
      >
        {marketBoard}
      </Panel>
      <PanelSplitter
        direction="vertical"
        className="h-2 shrink-0 cursor-row-resize bg-neutral-800 transition-colors hover:bg-emerald-500 data-[resize-handle-state=hover]:bg-emerald-500 data-[resize-handle-state=drag]:bg-emerald-500"
      />
      <Panel
        id="global-calendar"
        defaultSize={42}
        minSize={30}
        className="overflow-hidden"
      >
        {calendar}
      </Panel>
    </PanelGroup>
  );

  if (breakpoint === "desktop") {
    return (
      <PanelGroup
        autoSaveId="bursa-global-economy-layout"
        direction="horizontal"
        className="min-h-0 flex-1 overflow-hidden"
      >
        <Panel id="global-rates" defaultSize={18} minSize={15} order={1} className="min-h-0 overflow-hidden">
          {banks}
        </Panel>
        <PanelSplitter />
        <Panel id="global-main" defaultSize={57} minSize={40} order={2} className="min-h-0 overflow-hidden">
          {mainSplit}
        </Panel>
        <PanelSplitter />
        <Panel id="global-news" defaultSize={25} minSize={20} order={3} className="min-h-0 overflow-hidden">
          {news}
        </Panel>
      </PanelGroup>
    );
  }

  if (breakpoint === "tablet") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 border-b border-line bg-panel">
          <button
            type="button"
            onClick={() => setDrawer("banks")}
            className="min-h-11 flex-1 border-r border-line px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
          >
            Central Banks
          </button>
          <button
            type="button"
            onClick={() => setDrawer("news")}
            className="min-h-11 flex-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400"
          >
            News
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{mainSplit}</div>
        <SlideDrawer open={drawer === "banks"} onClose={() => setDrawer(null)} side="left">
          {banks}
        </SlideDrawer>
        <SlideDrawer open={drawer === "news"} onClose={() => setDrawer(null)} side="right">
          {news}
        </SlideDrawer>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MobileTabs
        tab={tab}
        onTab={setTab}
        panes={[
          { id: "markets", label: "Markets" },
          { id: "banks", label: "Banks" },
          { id: "news", label: "News" },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "banks" ? (
          banks
        ) : tab === "news" ? (
          news
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-[1.1] overflow-hidden">{marketBoard}</div>
            <div className="min-h-0 flex-1 overflow-hidden border-t border-line">{calendar}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileTabs({
  tab,
  onTab,
  panes,
}: {
  tab: GlobalTab;
  onTab: (tab: GlobalTab) => void;
  panes: { id: GlobalTab; label: string }[];
}) {
  return (
    <div className="flex shrink-0 border-b border-line bg-panel">
      {panes.map((pane) => (
        <button
          key={pane.id}
          type="button"
          onClick={() => onTab(pane.id)}
          aria-pressed={tab === pane.id}
          className={`min-h-11 flex-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
            tab === pane.id ? "bg-[#1a1a1a] text-amber-400" : "text-neutral-500"
          }`}
        >
          {pane.label}
        </button>
      ))}
    </div>
  );
}

const EMPTY_RATES = [
  { id: "fed" as const, label: "Fed Rate", region: "US", instrument: "EFFR", rate: null, changeBps: null, asOf: null, source: "last-print", bank: "Federal Reserve" },
  { id: "ecb" as const, label: "ECB Rate", region: "EU", instrument: "Deposit facility", rate: null, changeBps: null, asOf: null, source: "last-print", bank: "European Central Bank" },
  { id: "boj" as const, label: "BOJ Rate", region: "Japan", instrument: "Policy rate", rate: null, changeBps: null, asOf: null, source: "last-print", bank: "Bank of Japan" },
  { id: "pboc" as const, label: "PBOC", region: "China", instrument: "1-year LPR", rate: null, changeBps: null, asOf: null, source: "last-print", bank: "People's Bank of China" },
];
