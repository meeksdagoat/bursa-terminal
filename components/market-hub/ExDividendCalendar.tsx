"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pulse } from "@/components/skeleton";
import { formatKlStamp } from "@/lib/format";
import type { CorporateActionsPayload, ExDividendCategory, MarketHubExDiv } from "@/lib/types";
import { terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 2 * 60 * 1000;

type FilterBadge = "all" | "interim" | "final";

type ExDividendCalendarProps = {
  /** Optional hub-wide text filter (ticker / company). */
  filter?: string;
};

function matchesBadge(row: MarketHubExDiv, badge: FilterBadge): boolean {
  if (badge === "all") return true;
  if (badge === "interim") return row.category === "interim" || row.category === "special";
  return row.category === "final";
}

function categoryLabel(category: ExDividendCategory): string {
  if (category === "interim") return "Interim";
  if (category === "final") return "Final";
  if (category === "special") return "Special";
  return "Other";
}

function CalendarSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3" aria-busy="true" aria-label="Loading ex-dividend calendar">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-2 border-b border-neutral-900 py-2 last:border-0">
          <div className="flex gap-2">
            <Pulse className="h-3 w-12" />
            <Pulse className="h-3 w-28" />
            <Pulse className="h-3 w-14" />
          </div>
          <Pulse className="h-3 w-[85%]" />
          <div className="flex gap-3">
            <Pulse className="h-2.5 w-24" />
            <Pulse className="h-2.5 w-16" />
            <Pulse className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExDividendCalendar({ filter = "" }: ExDividendCalendarProps) {
  const feed = useLiveData<CorporateActionsPayload>("/api/corporate-actions", REFRESH_MS);
  const [badge, setBadge] = useState<FilterBadge>("all");

  const rows = useMemo(() => {
    const items = feed.data?.items ?? [];
    const needle = filter.trim().toLowerCase();
    return items.filter((row) => {
      if (!matchesBadge(row, badge)) return false;
      if (!needle) return true;
      return (
        row.title.toLowerCase().includes(needle) ||
        row.company?.toLowerCase().includes(needle) ||
        row.code?.toLowerCase().includes(needle) ||
        row.dividendType?.toLowerCase().includes(needle) ||
        false
      );
    });
  }, [feed.data?.items, badge, filter]);

  const loading = feed.loading && !feed.data;

  return (
    <div className="overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Ex-dividend calendar
        </div>
        <div className="flex border border-neutral-800">
          {(
            [
              ["all", "All"],
              ["interim", "Interim"],
              ["final", "Final"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBadge(id)}
              className={`min-h-9 px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] md:min-h-0 md:py-1 ${
                badge === id
                  ? "bg-gain/15 text-gain"
                  : "text-neutral-500 hover:text-neutral-300"
              } ${id !== "all" ? "border-l border-neutral-800" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <CalendarSkeleton />
      ) : feed.error && !feed.data ? (
        <p className="px-3 py-8 text-center font-mono text-[10px] text-neutral-600">
          Entitlement feed unavailable · {feed.error}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-8 text-center font-mono text-[10px] text-neutral-600">
          No dividend entitlements match this filter
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto overscroll-contain">
          <table className="w-full min-w-[640px] text-left">
            <thead className="sticky top-0 z-10 bg-[#0d0d0d]">
              <tr className="border-b border-neutral-800 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Entitlement</th>
                <th className="px-3 py-2 text-right">Ex-date</th>
                <th className="px-3 py-2 text-right">Book close</th>
                <th className="px-3 py-2 text-right">Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-900 hover:bg-[#121212]">
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.symbol ? (
                        <Link
                          href={terminalHref(row.symbol)}
                          className="font-mono text-[11px] text-gain hover:underline"
                        >
                          {row.code}
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px] text-neutral-500">
                          {row.code ?? "—"}
                        </span>
                      )}
                      <span className="border border-neutral-800 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-neutral-500">
                        {categoryLabel(row.category)}
                      </span>
                    </div>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block max-w-[220px] truncate text-[12px] text-neutral-200 hover:text-white"
                      title={row.title}
                    >
                      {row.company ?? "Company"}
                    </a>
                    <p className="mt-0.5 font-mono text-[9px] text-neutral-600">
                      {formatKlStamp(row.publishedAt)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-neutral-300">
                    {row.dividendType ?? "Dividend"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-neutral-100">
                    {row.entitlement ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-neutral-300">
                    {row.exDate ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-neutral-400">
                    {row.bookClosureDate ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-neutral-400">
                    {row.paymentDate ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
