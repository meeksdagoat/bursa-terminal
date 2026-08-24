"use client";

import { Eli5Block } from "@/components/eli5-summary";
import { summariseFiling } from "@/lib/eli5";
import { formatKlStamp } from "@/lib/format";
import type { Filing, FilingCategory, FilingsPayload } from "@/lib/types";

type FilingsPanelProps = {
  payload: FilingsPayload | null;
  error: string | null;
  loading: boolean;
  companyName: string;
};

const BADGE: Record<FilingCategory, string> = {
  QR: "border-amber-400/40 text-amber-400",
  IA: "border-sky-400/40 text-sky-300",
  GA: "border-line text-neutral-400",
  DIV: "border-gain/40 text-gain",
  BOARD: "border-violet-400/40 text-violet-300",
  AL: "border-orange-400/40 text-orange-300",
  OTHER: "border-line text-neutral-500",
};

export function FilingsPanel({ payload, error, loading, companyName }: FilingsPanelProps) {
  const items = payload?.items ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <FilingRow key={item.id} item={item} />
        ))}
        {items.length === 0 ? (
          <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
            {error
              ? `FILINGS FEED UNAVAILABLE · ${error}`
              : loading
                ? "LOADING BURSA ANNOUNCEMENTS…"
                : `NO RECENT FILINGS FOR ${companyName.toUpperCase()}`}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function FilingRow({ item }: { item: Filing }) {
  const body = (
    <div className="px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="w-[44px] shrink-0 font-mono text-[10px] text-neutral-500">
          {formatKlStamp(item.publishedAt)}
        </span>
        <span
          className={`shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${BADGE[item.category]}`}
        >
          {item.category}
        </span>
        <span className="min-w-0 text-[12px] font-medium leading-snug text-neutral-100">{item.title}</span>
      </div>
      <p className="mt-0.5 pl-[62px] font-mono text-[9px] uppercase tracking-wider text-neutral-600">
        {item.source}
        {item.url ? " ↗" : ""}
      </p>

      <div className="pl-[62px]">
        <Eli5Block
          build={() => summariseFiling(item.title, item.category)}
          subject={item.title}
        />
      </div>
    </div>
  );

  if (!item.url) return <li>{body}</li>;

  return (
    <li className="relative hover:bg-[#161616]">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${item.title} — open filing`}
        className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
      />
      <div className="pointer-events-none relative z-10">{body}</div>
    </li>
  );
}
