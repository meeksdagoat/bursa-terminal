"use client";

import { useState } from "react";
import { formatKlDate, formatOpr } from "@/lib/format";
import { filings, macroFeed } from "@/lib/mock-data";
import type { OprSnapshot } from "@/lib/types";

type Tab = "filings" | "macro";

type FilingsPanelProps = {
  opr: OprSnapshot | null;
};

export function FilingsPanel({ opr }: FilingsPanelProps) {
  const [tab, setTab] = useState<Tab>("filings");

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-7 shrink-0 items-center border-b border-line">
        <TabButton
          active={tab === "filings"}
          onClick={() => setTab("filings")}
          label="Bursa Regulatory Filings"
        />
        <TabButton
          active={tab === "macro"}
          onClick={() => setTab("macro")}
          label="Macro & Policy Intel"
        />
        <span className="ml-auto pr-2 font-mono text-[9px] text-neutral-700">
          {tab === "filings" ? "SAMPLE DATA" : "OPR LIVE · REST SAMPLE"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "filings" ? (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#161616]">
              <tr className="text-[9px] uppercase tracking-wider text-neutral-500">
                <th className="px-2 py-1.5 font-medium">Time</th>
                <th className="px-2 py-1.5 font-medium">Ticker</th>
                <th className="px-2 py-1.5 font-medium">Type</th>
                <th className="px-2 py-1.5 font-medium">Headline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filings.map((row) => (
                <tr
                  key={`${row.time}-${row.ticker}-${row.type}`}
                  className="hover:bg-[#161616]"
                >
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px] text-neutral-500">
                    {row.time}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px] text-gain">
                    {row.ticker}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-amber-400/80">
                    {row.type}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-neutral-200">{row.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-line">
            <li className="bg-[#101510] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="rounded-sm border border-gain/40 bg-gain/10 px-1 py-px font-mono text-[9px] tracking-wider text-gain">
                  BNM LIVE
                </span>
                <span className="text-[12px] font-medium text-neutral-100">
                  Overnight Policy Rate {formatOpr(opr?.level)}
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

            {macroFeed.map((item) => (
              <li key={item.title} className="px-2.5 py-2 hover:bg-[#161616]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-neutral-500">{item.time}</span>
                  <span className="rounded-sm border border-line px-1 py-px font-mono text-[9px] tracking-wider text-amber-400/90">
                    {item.source}
                  </span>
                  <span className="text-[12px] font-medium text-neutral-100">{item.title}</span>
                </div>
                <p className="mt-0.5 pl-[52px] text-[11px] leading-snug text-neutral-400">
                  {item.body}
                </p>
              </li>
            ))}
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
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full border-r border-line px-3 text-[10px] font-semibold uppercase tracking-[0.12em] ${
        active ? "bg-[#1a1a1a] text-amber-400" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
