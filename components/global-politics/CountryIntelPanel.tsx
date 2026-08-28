"use client";

import { Eli5Block } from "@/components/eli5-summary";
import { NewsFeedSkeleton } from "@/components/skeleton";
import { hasValidSummary } from "@/lib/eli5";
import { activityStatusLabel, riskLevelLabel } from "@/lib/geopolitics/analyze";
import type { CountryGeopoliticsMetrics } from "@/lib/geopolitics/types";
import { formatKlStamp } from "@/lib/format";
import type { Headline } from "@/lib/types";

type CountryIntelPanelProps = {
  country: CountryGeopoliticsMetrics | null;
  globalItems: Headline[];
  loading: boolean;
  onClear: () => void;
  compact?: boolean;
};

function impactBadge(eventType: CountryGeopoliticsMetrics["eventType"]): string {
  switch (eventType) {
    case "conflict":
      return "CONFLICT";
    case "disaster":
      return "DISASTER";
    case "election":
      return "POLICY";
    default:
      return "WIRE";
  }
}

function badgeTone(level: CountryGeopoliticsMetrics["riskLevel"]): string {
  switch (level) {
    case "crisis":
      return "border-loss/40 bg-loss/10 text-loss";
    case "high":
      return "border-orange-500/40 bg-orange-500/10 text-orange-400";
    case "elevated":
      return "border-amber-400/40 bg-amber-400/10 text-amber-400";
    default:
      return "border-neutral-700 bg-[#161616] text-neutral-400";
  }
}

export function CountryIntelPanel({
  country,
  globalItems,
  loading,
  onClear,
  compact = false,
}: CountryIntelPanelProps) {
  const shellClass = compact
    ? "flex h-full min-h-0 flex-col overflow-hidden bg-[#0d0d0d]"
    : "flex h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-[#0d0d0d]";

  if (!country) {
    return (
      <section className={shellClass}>
        <div className="shrink-0 border-b border-line px-3 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Global Political Wire
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            Click or tap any country on the map to open localized intelligence.
          </p>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
          {loading ? (
            <NewsFeedSkeleton />
          ) : (
            <ul className="divide-y divide-line">
              {globalItems.slice(0, 10).map((item) => (
                <IntelStoryRow key={item.id} item={item} />
              ))}
              {globalItems.length === 0 ? (
                <li className="px-3 py-8 text-center font-mono text-[11px] text-neutral-600">
                  NO HEADLINES IN THE CURRENT WINDOW
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <div className="shrink-0 border-b border-line px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
              {country.name} — News Stream
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded border px-2 py-0.5 font-mono text-[9px] ${badgeTone(country.riskLevel)}`}>
                {riskLevelLabel(country.riskLevel)}
              </span>
              <span className="rounded border border-neutral-800 bg-[#161616] px-2 py-0.5 font-mono text-[9px] text-neutral-400">
                {activityStatusLabel(country)}
              </span>
              <span className="rounded border border-neutral-800 bg-[#161616] px-2 py-0.5 font-mono text-[9px] text-neutral-400">
                {impactBadge(country.eventType)}
              </span>
            </div>
          </div>
          {!compact ? (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded border border-neutral-800 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:border-amber-400/40 hover:text-amber-400"
            >
              Reset map
            </button>
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
        {loading && country.articles.length === 0 ? (
          <NewsFeedSkeleton />
        ) : country.articles.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="font-mono text-[11px] leading-relaxed text-neutral-500">
              NO ACTIVE CONFLICT OR DIPLOMATIC ALERTS DETECTED FOR {country.name.toUpperCase()}.
            </p>
            <p className="mt-2 font-mono text-[10px] text-neutral-600">MONITORING LIVE WIRE…</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {country.articles.map((item) => (
              <IntelStoryRow key={`${country.iso2}:${item.id}`} item={item} showImpact />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function IntelStoryRow({ item, showImpact = false }: { item: Headline; showImpact?: boolean }) {
  return (
    <li className="relative hover:bg-[#161616]">
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.title} — open story`}
          className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
        />
      ) : null}
      <div className="pointer-events-none relative z-10 flex flex-col gap-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {showImpact && item.tag ? (
            <span className="font-mono text-[9px] text-gain">{item.tag}</span>
          ) : null}
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            {item.publisher ?? "Wire"} · {formatKlStamp(item.publishedAt)} MYT
          </span>
        </div>
        <p className="line-clamp-3 text-[13px] font-medium leading-snug text-neutral-100">{item.title}</p>
        {item.snippet ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-500">{item.snippet}</p>
        ) : null}
        {hasValidSummary({ title: item.title }) ? (
          <div className="pointer-events-auto">
            <Eli5Block news={{ title: item.title, url: item.url }} subject={item.title} />
          </div>
        ) : null}
      </div>
    </li>
  );
}
