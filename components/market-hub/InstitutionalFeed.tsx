"use client";

import Link from "next/link";
import { ExDividendCalendar } from "@/components/market-hub/ExDividendCalendar";
import { formatKlStamp } from "@/lib/format";
import { resolveBursaAnnouncementUrl } from "@/lib/filing-id";
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

function form29bHref(row: MarketHubForm29B): string {
  const announcementId = row.id.startsWith("snapshot-") ? null : row.id;
  return resolveBursaAnnouncementUrl({
    id: announcementId,
    bursaUrl: row.bursaUrl,
    url: row.url,
    pdfUrl: row.pdfUrl,
    stockCode: row.code,
  });
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function Form29BRow({ row }: { row: MarketHubForm29B }) {
  const href = form29bHref(row);

  return (
    <li className="group flex items-stretch transition-colors hover:bg-white/[0.04]">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${row.title} — open on Bursa Malaysia`}
        title={row.title}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-3 py-2.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
      >
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
            {row.code ? (
              <span className="font-mono text-[10px] text-neutral-500">{row.code}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] leading-snug text-neutral-200 group-hover:text-white">
            {row.title}
          </p>
          <p className="mt-1 font-mono text-[10px] text-neutral-600">
            {row.company ?? "—"} · {formatKlStamp(row.publishedAt)}
          </p>
        </div>
        <ExternalLinkIcon className="mt-0.5 shrink-0 text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100" />
      </a>
      {row.symbol ? (
        <Link
          href={terminalHref(row.symbol)}
          title={`Open ${row.code} in terminal`}
          className="flex shrink-0 items-center self-stretch border-l border-neutral-900 px-2.5 font-mono text-[10px] text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-gain"
        >
          {row.code}
        </Link>
      ) : null}
    </li>
  );
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
                filings.map((row) => <Form29BRow key={row.id} row={row} />)
              )}
            </ul>
          )}
        </div>

        <ExDividendCalendar filter={filter} />
      </div>
    </section>
  );
}
