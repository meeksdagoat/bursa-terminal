"use client";

import { useEffect, useState } from "react";
import { FilingsModal } from "@/components/FilingsModal";
import { ShowMoreBar } from "@/components/h-scroll";
import { NewsFeedSkeleton } from "@/components/skeleton";
import { formatKlStamp } from "@/lib/format";
import { classifyEventSentiment, EVENT_SENTIMENT_BADGE, EVENT_SENTIMENT_LABEL } from "@/lib/event-classify";
import { toViewerFiling } from "@/lib/filing-id";
import type { AnnouncementCategory, BursaAnnouncement, BursaAnnouncementsPayload, MarketAnnouncement } from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";

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
  const [selected, setSelected] = useState<MarketAnnouncement | null>(null);

  const ready = data?.symbol === symbol;
  const payload = ready ? data : null;
  const items = payload?.items ?? [];
  const pending = !ready || (loading && !payload);
  const visible = items.slice(0, limit);

  useEffect(() => {
    setSelected(null);
    setLimit(24);
  }, [symbol]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-600">
        {payload?.source === "google-news"
          ? "GOOGLE NEWS RSS · BURSA FILTER"
          : "BURSA FILINGS · LIVE"}{" "}
        · {symbol}
      </p>
      {pending && items.length === 0 && !error ? (
        <NewsFeedSkeleton rows={6} />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((item) => (
            <AnnouncementRow
              key={item.id}
              item={item}
              activeTicker={symbol}
              companyName={companyName}
              onOpen={setSelected}
            />
          ))}
          {items.length === 0 ? (
            <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
              {error
                ? `ANNOUNCEMENTS FEED UNAVAILABLE · ${error}`
                : `NO RECENT ANNOUNCEMENTS FOR ${companyName.toUpperCase()}`}
            </li>
          ) : null}
        </ul>
      )}
      <ShowMoreBar remaining={items.length - visible.length} onClick={() => setLimit((n) => n + 24)} />
      {selected ? (
        <FilingsModal
          key={`${symbol}-${selected.id}`}
          activeTicker={symbol}
          activeCompany={companyName}
          selectedFilingId={selected.id}
          selectedFiling={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function AnnouncementRow({
  item,
  activeTicker,
  companyName,
  onOpen,
}: {
  item: BursaAnnouncement;
  activeTicker: string;
  companyName: string;
  onOpen: (filing: MarketAnnouncement) => void;
}) {
  const sentiment = classifyEventSentiment(item.title, item.category);
  const filing = toViewerFiling(item, activeTicker, companyName);
  const body = (
    <div className="flex flex-col gap-2 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 font-mono text-[10px] text-zinc-400">{formatKlStamp(item.publishedAt)}</span>
        <span
          className={`shrink-0 whitespace-nowrap rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${EVENT_SENTIMENT_BADGE[sentiment]}`}
        >
          {EVENT_SENTIMENT_LABEL[sentiment]}
        </span>
        <span
          className={`shrink-0 whitespace-nowrap rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${BADGE[item.category]}`}
        >
          {item.category}
        </span>
      </div>
      <p className="line-clamp-2 min-w-0 overflow-hidden text-[12px] font-medium leading-snug text-neutral-100" title={item.title}>
        {item.title}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-400">
        {item.source}
        {item.url ? " ↗" : ""}
      </p>
    </div>
  );

  if (filing) {
    return (
      <li className="relative hover:bg-[#161616]">
        <button
          type="button"
          onClick={() => onOpen(filing)}
          aria-label={`${item.title} — open filing`}
          title={item.title}
          className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
        />
        <div className="pointer-events-none relative z-10">{body}</div>
      </li>
    );
  }

  if (!item.url) return <li>{body}</li>;

  return (
    <li className="relative hover:bg-[#161616]">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${item.title} — open filing`}
        title={item.title}
        className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
      />
      <div className="pointer-events-none relative z-10">{body}</div>
    </li>
  );
}
