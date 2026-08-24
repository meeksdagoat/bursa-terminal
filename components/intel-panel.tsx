"use client";

import { useState } from "react";
import { FilingsPanel } from "@/components/filings-panel";
import { Jargon } from "@/components/jargon-term";
import { TechnicalGauge } from "@/components/technical-gauge";
import { formatKlDate, formatKlStamp, formatOpr } from "@/lib/format";
import type { FilingsPayload, MacroPayload, OprSnapshot } from "@/lib/types";
import { useShariahOnly } from "@/lib/use-shariah";

type Tab = "technicals" | "filings" | "macro";

type IntelPanelProps = {
  symbol: string;
  opr: OprSnapshot | null;
  macro: MacroPayload | null;
  macroError: string | null;
  macroLoading: boolean;
  filings: FilingsPayload | null;
  filingsError: string | null;
  filingsLoading: boolean;
  companyName: string;
  /** Whether the charted company is on the curated Shariah list. */
  companyShariah: boolean;
};

export function IntelPanel({
  symbol,
  opr,
  macro,
  macroError,
  macroLoading,
  filings,
  filingsError,
  filingsLoading,
  companyName,
  companyShariah,
}: IntelPanelProps) {
  const [tab, setTab] = useState<Tab>("technicals");
  const shariahOnly = useShariahOnly();
  const items = macro?.items ?? [];
  const filingsBlocked = shariahOnly && !companyShariah;

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex min-h-11 shrink-0 items-center overflow-x-auto border-b border-line md:h-7 md:min-h-0">
        <TabButton
          active={tab === "technicals"}
          onClick={() => setTab("technicals")}
          label="Technical Analytics"
          shortLabel="Tech"
        />
        <TabButton
          active={tab === "filings"}
          onClick={() => setTab("filings")}
          label="Bursa Regulatory Filings"
          shortLabel="Filings"
        />
        <TabButton
          active={tab === "macro"}
          onClick={() => setTab("macro")}
          label="Macro & Policy Intel"
          shortLabel="Macro"
        />

        <span
          className={`ml-auto hidden pr-2 font-mono text-[9px] md:inline ${
            (tab === "macro" && macroError) || (tab === "filings" && filingsError)
              ? "text-loss"
              : "text-neutral-700"
          }`}
        >
          {tab === "technicals"
            ? `1Y DAILY · ${symbol}`
            : tab === "filings"
              ? filingsBlocked
                ? "HIDDEN BY SHARIAH FILTER"
                : filingsError
                  ? "FILINGS FEED ERROR"
                  : `LIVE · ${filings?.items.length ?? 0}`
              : macroError
                ? "OPR LIVE · POLICY FEED ERROR"
                : `OPR LIVE · POLICY LIVE · ${items.length}`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "technicals" ? (
          <TechnicalGauge symbol={symbol} companyName={companyName} />
        ) : tab === "filings" ? (
          filingsBlocked ? (
            <p className="px-2.5 py-3 font-mono text-[10px] leading-relaxed text-neutral-600">
              {companyName.toUpperCase()} IS NOT ON THE SHARIAH LIST · FILINGS HIDDEN WHILE THE
              SHARIAH FILTER IS ON
            </p>
          ) : (
            <FilingsPanel
              payload={filings?.symbol ? filings : null}
              error={filingsError}
              loading={filingsLoading}
              companyName={companyName}
            />
          )
        ) : (
          <ul className="divide-y divide-line">
            <li className="bg-[#101510] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="rounded-sm border border-gain/40 bg-gain/10 px-1 py-px font-mono text-[9px] tracking-wider text-gain">
                  BNM LIVE
                </span>
                <span className="text-[12px] font-medium text-neutral-100">
                  <Jargon term="opr">Overnight Policy Rate</Jargon> {formatOpr(opr?.level)}
                </span>
                {opr?.changeBps != null ? (
                  <span className="font-mono text-[10px] text-neutral-400">
                    {opr.changeBps === 0
                      ? "unchanged"
                      : `${opr.changeBps > 0 ? "+" : ""}${opr.changeBps}bps`}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">
                Effective {formatKlDate(opr?.effectiveDate)}
                {opr?.lastUpdated ? ` · BNM last updated ${opr.lastUpdated}` : ""}
              </p>
            </li>

            {items.map((item) => (
              <li key={item.id} className="relative hover:bg-[#161616]">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.title} — open on ${item.publisher ?? "source"}`}
                    className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
                  />
                ) : null}

                <div className="pointer-events-none relative z-10 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-[44px] shrink-0 font-mono text-[10px] text-neutral-500">
                      {formatKlStamp(item.publishedAt)}
                    </span>
                    <span className="shrink-0 rounded-sm border border-line px-1 py-px font-mono text-[9px] tracking-wider text-amber-400/90">
                      {item.source}
                    </span>
                    <span className="text-[12px] font-medium leading-snug text-neutral-100">
                      {item.title}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-[62px] text-[11px] leading-snug text-neutral-400">
                    {item.publisher ?? "Google News"} · {formatKlDate(item.publishedAt)}
                    {item.url ? " ↗" : ""}
                  </p>
                </div>
              </li>
            ))}

            {items.length === 0 ? (
              <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
                {macroError
                  ? `POLICY FEED UNAVAILABLE · ${macroError}`
                  : macroLoading
                    ? "LOADING POLICY HEADLINES…"
                    : "NO POLICY HEADLINES RETURNED"}
              </li>
            ) : null}
          </ul>
        )}
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
      className={`h-full min-h-11 shrink-0 border-r border-line px-3 text-[10px] font-semibold uppercase tracking-[0.12em] md:min-h-0 ${
        active ? "bg-[#1a1a1a] text-amber-400" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <span className="md:hidden">{shortLabel}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
