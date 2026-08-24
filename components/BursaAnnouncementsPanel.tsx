"use client";

import { formatKlStamp } from "@/lib/format";
import type { AnnouncementCategory, BursaAnnouncement, BursaAnnouncementsPayload } from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";
import { ShowMoreBar } from "@/components/h-scroll";
import { useState } from "react";

const REFRESH_MS = 5 * 60 * 1000;

const BADGE: Record<AnnouncementCategory, string> = {
  "Financial Result": "border-amber-400/40 text-amber-400",
  "Shareholding Change": "border-sky-400/40 text-sky-300",
  "General Announcement": "border-line text-neutral-400",
  Dividend: "border-gain/40 text-gain",
  "Board Change": "border-violet-400/40 text-violet-300",
  "Additional Listing": "border-orange-400/40 text-orange-300",
  Other: "border-line text-neutral-500",
};

type BursaAnnouncementsPanelProps = {
  symbol: string;
  companyName: string;
};

export function BursaAnnouncementsPanel({ symbol, companyName }: BursaAnnouncementsPanelProps) {
  const url = `/api/bursa/announcements?symbol=${encodeURIComponent(symbol)}`;
  const { data, error, loading } = useLiveData<BursaAnnouncementsPayload>(url, REFRESH_MS);
  const [limit, setLimit] = useState(24);

  const ready = data?.symbol === symbol;
  const payload = ready ? data : null;
  const items = payload?.items ?? [];
  const pending = !ready || (loading && !payload);
  const visible = items.slice(0, limit);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-600">
        {payload?.source === "google-news"
          ? "GOOGLE NEWS RSS · BURSA FILTER"
          : "BURSA FILINGS · LIVE"}{" "}
        · {symbol}
      </p>
      <ul className="divide-y divide-line">
        {visible.map((item) => (
          <AnnouncementRow key={item.id} item={item} />
        ))}
        {items.length === 0 ? (
          <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
            {error
              ? `ANNOUNCEMENTS FEED UNAVAILABLE · ${error}`
              : pending
                ? `LOADING ${companyName.toUpperCase()} ANNOUNCEMENTS…`
                : `NO RECENT ANNOUNCEMENTS FOR ${companyName.toUpperCase()}`}
          </li>
        ) : null}
      </ul>
      <ShowMoreBar remaining={items.length - visible.length} onClick={() => setLimit((n) => n + 24)} />
    </div>
  );
}

function AnnouncementRow({ item }: { item: BursaAnnouncement }) {
  const body = (
    <div className="px-2.5 py-2">
      <div className="flex items-start gap-2">
        <span className="w-[44px] shrink-0 pt-0.5 font-mono text-[10px] text-neutral-500">
          {formatKlStamp(item.publishedAt)}
        </span>
        <span
          className={`mt-0.5 shrink-0 whitespace-nowrap rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${BADGE[item.category]}`}
        >
          {item.category}
        </span>
        <span className="min-w-0 text-[12px] font-medium leading-snug text-neutral-100">{item.title}</span>
      </div>
      <p className="mt-0.5 pl-[62px] font-mono text-[9px] uppercase tracking-wider text-neutral-600">
        {item.source}
        {item.url ? " ↗" : ""}
      </p>
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
