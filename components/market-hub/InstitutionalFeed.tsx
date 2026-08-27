"use client";

import Link from "next/link";
import { ExDividendCalendar } from "@/components/market-hub/ExDividendCalendar";
import { formatKlStamp } from "@/lib/format";
import type { MarketHubForm29B } from "@/lib/types";
import { terminalHref } from "@/lib/universe";

type InstitutionalFeedProps = {
  form29b: MarketHubForm29B[];
  filter: string;
  loading?: boolean;
};

function actionTone(action: MarketHubForm29B["action"]) {
  if (action === "Acquisition") return "text-gain";
  if (action === "Disposal") return "text-loss";
  return "text-amber-400";
}

export function InstitutionalFeed({ form29b, filter, loading }: InstitutionalFeedProps) {
  const needle = filter.trim().toLowerCase();

  const filings = needle
    ? form29b.filter(
        (row) =>
          row.title.toLowerCase().includes(needle) ||
          row.company?.toLowerCase().includes(needle) ||
          row.institution?.toLowerCase().includes(needle) ||
          row.code?.toLowerCase().includes(needle),
      )
    : form29b;

  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Institutional &amp; Corporate Flows
        </h2>
      </header>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
          <div className="border-b border-neutral-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Form 29B · institution activity
          </div>
          {loading ? (
            <p className="px-3 py-8 text-center font-mono text-[10px] text-neutral-600">
              Loading filings…
            </p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-neutral-900 overflow-y-auto overscroll-contain">
              {filings.length === 0 ? (
                <li className="px-3 py-8 text-center font-mono text-[10px] text-neutral-600">
                  No Form 29B / institutional notices in the latest wire
                </li>
              ) : (
                filings.map((row) => (
                  <li key={row.id} className="px-3 py-2.5 hover:bg-[#121212]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.institution ? (
                            <span className="border border-gain/30 bg-gain/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gain">
                              {row.institution}
                            </span>
                          ) : null}
                          {row.action ? (
                            <span
                              className={`font-mono text-[9px] uppercase tracking-wider ${actionTone(row.action)}`}
                            >
                              {row.action}
                            </span>
                          ) : null}
                          {row.symbol ? (
                            <Link
                              href={terminalHref(row.symbol)}
                              className="font-mono text-[10px] text-neutral-500 hover:text-gain"
                            >
                              {row.code}
                            </Link>
                          ) : null}
                        </div>
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-[12px] leading-snug text-neutral-200 hover:text-white"
                        >
                          {row.title}
                        </a>
                        <p className="mt-1 font-mono text-[10px] text-neutral-600">
                          {row.company ?? "—"} · {formatKlStamp(row.publishedAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <ExDividendCalendar filter={filter} />
      </div>
    </section>
  );
}
