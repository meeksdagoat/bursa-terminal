"use client";

import type { ReactNode } from "react";
import { ECONOMY_DESK_TAGS } from "@/lib/categories";
import { Eli5Block } from "@/components/eli5-summary";
import { HeadlineList } from "@/components/headline-list";
import { Jargon } from "@/components/jargon-term";
import { ResponsiveSplit } from "@/components/responsive-split";
import { upcomingEvents } from "@/lib/economy-calendar";
import { summariseDosmStat, summariseMacroEvent } from "@/lib/eli5";
import { changeClass, formatKlDate, formatKlStamp, formatOpr, formatPct, formatPrice } from "@/lib/format";
import { FX_PAIRS, ratesHaveValues } from "@/lib/fx-live";
import type { JargonTerm } from "@/lib/jargon";
import { formatHeatmapPct, heatmapRows, heatmapValueClass } from "@/lib/sectors";
import type { BnmPayload, EconomyPayload, HeadlinesPayload, SectorPerformance } from "@/lib/types";
import { useEconomyLive } from "@/lib/use-economy-live";

type EconomyDeskProps = {
  bnm: BnmPayload | null;
  economy: EconomyPayload | null;
  economyError: string | null;
  sectors: SectorPerformance[];
  headlines: HeadlinesPayload | null;
  headlinesError: string | null;
  headlinesLoading: boolean;
};

export function EconomyDesk({
  bnm,
  economy,
  economyError,
  sectors,
  headlines,
  headlinesError,
  headlinesLoading,
}: EconomyDeskProps) {
  const live = useEconomyLive(sectors);
  const opr = bnm?.opr ?? null;
  const cpi = economy?.cpi ?? null;
  const cpo = economy?.commodities.find((item) => item.id === "cpo") ?? null;
  const brent = economy?.commodities.find((item) => item.id === "brent") ?? null;
  const rates = ratesHaveValues(live.rates) ? live.rates : (bnm?.rates ?? []);
  const fxLoading = live.fxLoading && !ratesHaveValues(rates);
  const snapshot = economy?.snapshot ?? [];
  const heatmapSectors = live.sectors.length > 0 ? live.sectors : sectors;
  const heatmap = heatmapRows(heatmapSectors);
  const heatmapLoading = live.heatmapLoading && heatmap.every((row) => row.changePct == null);
  const events = upcomingEvents();
  const sessionBadge = live.sessionLive ? "LIVE" : "LAST SESSION";

  return (
    <ResponsiveSplit
      autoSaveId="bursa-economy-layout"
      left={{
        id: "economy-main",
        label: "Economy",
        defaultSize: 60,
        minSize: 40,
        content: (
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-neutral-800 px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Economy
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            BNM OPR · DOSM CPI · BMD FCPO · Brent · live feeds
          </p>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#0a0a0a] pr-2">
          <div className="grid grid-cols-2 gap-px bg-neutral-800 md:grid-cols-4">
            <Indicator
              label="BNM OPR"
              term="opr"
              value={formatOpr(opr?.level)}
              hint={opr?.effectiveDate ? `eff. ${formatKlDate(opr.effectiveDate)}` : "BNM Open API"}
              change={
                opr?.changeBps == null
                  ? null
                  : opr.changeBps === 0
                    ? "UNCH"
                    : `${opr.changeBps > 0 ? "+" : ""}${opr.changeBps}bps`
              }
              live
            />
            <Indicator
              label="CPI YoY"
              term="cpi"
              value={cpi?.yoy != null ? `${cpi.yoy.toFixed(1)}%` : "—"}
              hint={cpi?.period ? `DOSM ${formatKlDate(cpi.period)}` : "DOSM Open API"}
              change={cpi?.mom != null ? `MoM ${formatPct(cpi.mom)}` : null}
              live
            />
            <Indicator
              label="CPO"
              value={cpo?.price != null ? formatPrice(cpo.price) : "—"}
              hint={`${cpo?.unit ?? "MYR/t"}${cpo?.source === "bmd-fcpo" ? " · BMD FCPO" : ""}`}
              change={cpo?.changePct != null ? formatPct(cpo.changePct) : null}
              live
            />
            <Indicator
              label="Brent"
              value={brent?.price != null ? formatPrice(brent.price) : "—"}
              hint={brent?.unit ?? "USD/bbl"}
              change={brent?.changePct != null ? formatPct(brent.changePct) : null}
              live
            />
          </div>

          {economyError ? (
            <p className="border-b border-neutral-800 px-3 py-1.5 font-mono text-[10px] text-loss">
              MACRO FEED · {economyError}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 p-2 lg:grid-cols-2">
            <Card title="FX & Commodity Matrix">
              <div className="grid grid-cols-2 gap-px bg-neutral-800">
                {FX_PAIRS.map((pair) => {
                  const rate = rates.find((item) => item.pair === pair);
                  const changePct = rate?.changePct ?? null;
                  return (
                    <div key={pair} className="bg-[#0a0a0a] px-2.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] tracking-wider text-neutral-500">
                          {pair}
                        </span>
                        <span
                          className={`rounded-sm border px-1 py-px font-mono text-[9px] ${toneBadgeClass(changePct)}`}
                        >
                          {fxLoading ? "..." : formatPct(changePct)}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[16px] text-neutral-100">
                        {fxLoading ? "..." : rate?.rate != null ? rate.rate.toFixed(4) : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
              {live.fxError ? (
                <p className="border-t border-neutral-800 px-2.5 py-1.5 font-mono text-[9px] text-loss">
                  FX FEED · {live.fxError}
                </p>
              ) : (
                <p className="border-t border-neutral-800 px-2.5 py-1 font-mono text-[8px] uppercase tracking-wider text-neutral-700">
                  {live.fxSource === "open-er" ? "OPEN ER API · 30S POLL" : "BNM OPEN API · 30S POLL"}
                </p>
              )}
            </Card>

            <Card title="DOSM Macro Snapshot">
              <ul className="divide-y divide-neutral-800">
                {(snapshot.length > 0 ? snapshot : EMPTY_SNAPSHOT).map((row) => (
                  <li key={row.id} className="px-2.5 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-neutral-300">{row.label}</p>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                          {row.hint}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[13px] ${
                          row.id === "unemployment" ? "text-neutral-100" : changeClass(row.value)
                        }`}
                      >
                        {row.display}
                      </span>
                    </div>
                    <Eli5Block build={() => summariseDosmStat(row)} subject={row.label} />
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Bursa Sector Heatmap">
              <div className="flex items-center justify-between border-b border-neutral-800 px-2.5 py-1">
                <p className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">
                  {live.sessionLive ? "SESSION TAPE" : "OUTSIDE HOURS"}
                  {live.marketState ? ` · ${live.marketState}` : ""}
                </p>
                <span
                  className={`rounded-sm border px-1 py-px font-mono text-[8px] uppercase tracking-wider ${
                    live.sessionLive
                      ? "border-gain/40 bg-gain/10 text-gain"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {sessionBadge}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-neutral-800 sm:grid-cols-3">
                {heatmap.map((row) => {
                  const tone = heatmapTone(row.changePct);
                  return (
                    <div key={row.label} className="bg-[#0a0a0a] px-2.5 py-2.5">
                      <p className="text-[10px] leading-snug text-neutral-400">{row.label}</p>
                      <p className={`mt-1 font-mono text-[14px] ${heatmapValueClass(row.changePct)}`}>
                        {heatmapLoading ? "..." : formatHeatmapPct(row.changePct)}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-sm border px-1 py-px font-mono text-[8px] uppercase tracking-wider ${tone.badgeClass}`}
                      >
                        {heatmapLoading ? "..." : tone.badge}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="BNM & Economic Events Calendar">
              <ul className="divide-y divide-neutral-800">
                {events.map((event) => (
                  <li key={event.id} className="px-2.5 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-neutral-200">{event.title}</p>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                          {event.source} · {formatKlDate(event.date)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-sm border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300">
                        {event.badge}
                      </span>
                    </div>
                    <Eli5Block
                      build={() =>
                        summariseMacroEvent({
                          title: event.title,
                          source: event.source,
                          when: `${formatKlDate(event.date)} · ${event.badge}`,
                        })
                      }
                      subject={event.title}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <p className="px-3 pb-2 font-mono text-[9px] text-neutral-700">
            UPDATED {economy?.asOf ? formatKlStamp(economy.asOf) : "—"} · OPR {bnm?.session ?? "—"} SESSION
          </p>
        </div>
      </div>
        ),
      }}
      right={{
        id: "economy-news",
        label: "News",
        defaultSize: 40,
        minSize: 20,
        content: (
        <HeadlineList
          category="my-economy"
          payload={headlines}
          error={headlinesError}
          loading={headlinesLoading}
          pinnedTags={ECONOMY_DESK_TAGS}
          heading="News"
        />
        ),
      }}
    />
  );
}

const EMPTY_SNAPSHOT = [
  { id: "gdp" as const, label: "GDP Growth YoY", value: null, display: "—", hint: "DOSM", period: null },
  { id: "unemployment" as const, label: "Unemployment Rate", value: null, display: "—", hint: "DOSM", period: null },
  { id: "trade" as const, label: "Trade Balance Surplus", value: null, display: "—", hint: "DOSM", period: null },
  { id: "ipi" as const, label: "Industrial Production Index", value: null, display: "—", hint: "DOSM", period: null },
];

function toneBadgeClass(changePct: number | null): string {
  if (changePct == null || changePct === 0) {
    return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  }
  if (changePct > 0) return "border-gain/40 bg-gain/10 text-gain";
  return "border-loss/40 bg-loss/10 text-loss";
}

function heatmapTone(changePct: number | null): {
  badge: string;
  badgeClass: string;
} {
  const n = Number.parseFloat(String(changePct ?? 0));
  if (!Number.isFinite(n) || n === 0) {
    return {
      badge: "FLAT",
      badgeClass: "border-neutral-700 text-neutral-400",
    };
  }
  if (n > 0) {
    return {
      badge: "UP",
      badgeClass: "border-emerald-500/40 text-emerald-400",
    };
  }
  return {
    badge: "DOWN",
    badgeClass: "border-rose-500/40 text-rose-400",
  };
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-sm border border-neutral-800 bg-[#0a0a0a]">
      <h3 className="border-b border-neutral-800 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Indicator({
  label,
  value,
  hint,
  change,
  live,
  term,
}: {
  label: string;
  value: string;
  hint: string;
  change: string | null;
  live?: boolean;
  term?: JargonTerm;
}) {
  return (
    <div className="bg-[#0a0a0a] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          {term ? <Jargon term={term}>{label}</Jargon> : label}
        </span>
        {live ? (
          <span className="rounded-sm border border-gain/40 bg-gain/10 px-1 font-mono text-[8px] tracking-wider text-gain">
            LIVE
          </span>
        ) : null}
      </div>
      <p className="mt-1 font-mono text-[18px] text-neutral-100">{value}</p>
      <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
        {hint}
        {change ? ` · ${change}` : ""}
      </p>
    </div>
  );
}
