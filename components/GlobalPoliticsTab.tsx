"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CountryIntelPanel } from "@/components/global-politics/CountryIntelPanel";
import { MapLegendPanel } from "@/components/global-politics/MapLegend";
import { NewsWindowNotice } from "@/components/news-window-notice";
import { SlideDrawer } from "@/components/slide-drawer";
import {
  analyzeGeopoliticsHeadlines,
  countryMetricsForIso2,
} from "@/lib/geopolitics/analyze";
import type { GlobalPoliticsNewsPayload } from "@/lib/geopolitics/types";
import { useBreakpoint, useCoarsePointer } from "@/lib/use-media-query";

const WorldPoliticsMap = dynamic(
  () =>
    import("@/components/global-politics/WorldPoliticsMap").then((module) => module.WorldPoliticsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded border border-neutral-800 bg-[#0a0a0a]">
        <p className="font-mono text-[11px] text-neutral-500">Loading world map…</p>
      </div>
    ),
  },
);

type GlobalPoliticsTabProps = {
  headlines: GlobalPoliticsNewsPayload | null;
  headlinesError: string | null;
  headlinesLoading: boolean;
};

export function GlobalPoliticsTab({
  headlines,
  headlinesError,
  headlinesLoading,
}: GlobalPoliticsTabProps) {
  const breakpoint = useBreakpoint();
  const isCoarsePointer = useCoarsePointer();
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null);
  const [hoveredIso2, setHoveredIso2] = useState<string | null>(null);

  const items =
    headlines?.category === "world-politics" ? headlines.items : [];

  const model = useMemo(() => analyzeGeopoliticsHeadlines(items), [items]);
  const selectedCountry = selectedIso2
    ? countryMetricsForIso2(model, selectedIso2)
    : null;

  const showInlinePanel = breakpoint === "desktop";
  const showMobileSheet = !showInlinePanel && selectedIso2 != null;
  const activeZones = Object.values(model.byIso2).filter((row) => row.articleCount > 0).length;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-panel px-3 py-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Global Politics — Geopolitical Dashboard
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Universal country map · multi-source wire · zoom labels · tap-to-inspect
          </p>
        </div>
        <span className={`font-mono text-[10px] ${headlinesError ? "text-loss" : "text-neutral-600"}`}>
          {headlinesError
            ? "FEED ERROR"
            : `${items.length} STORIES · ${activeZones} ACTIVE ZONES · ${model.unmatchedCount} UNMAPPED`}
        </span>
      </div>

      <NewsWindowNotice />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`relative min-h-0 min-w-0 ${showInlinePanel ? "flex-[1.4]" : "flex-1"}`}>
          <WorldPoliticsMap
            model={model}
            selectedIso2={selectedIso2}
            hoveredIso2={hoveredIso2}
            onSelectCountry={setSelectedIso2}
            onHoverCountry={setHoveredIso2}
            isCoarsePointer={isCoarsePointer}
          />
          <MapLegendPanel />
        </div>

        {showInlinePanel ? (
          <div className="min-h-0 w-[min(380px,38vw)] shrink-0">
            <CountryIntelPanel
              country={selectedCountry}
              globalItems={items}
              loading={headlinesLoading}
              onClear={() => setSelectedIso2(null)}
            />
          </div>
        ) : null}
      </div>

      <SlideDrawer
        open={showMobileSheet}
        onClose={() => setSelectedIso2(null)}
        side="bottom"
        title={selectedCountry ? `${selectedCountry.name} — News Stream` : undefined}
        className="max-h-[85vh]"
        bodyClassName="overflow-y-auto overscroll-contain touch-pan-y"
      >
        {selectedCountry ? (
          <CountryIntelPanel
            country={selectedCountry}
            globalItems={items}
            loading={headlinesLoading}
            onClear={() => setSelectedIso2(null)}
            compact
          />
        ) : null}
      </SlideDrawer>
    </section>
  );
}
