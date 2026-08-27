"use client";

import { useEffect, useState } from "react";
import { Eli5Block } from "@/components/eli5-summary";
import { FilingsModal } from "@/components/FilingsModal";
import { NewsFeedSkeleton } from "@/components/skeleton";
import { summariseFiling } from "@/lib/eli5";
import { announcementIdFromUrl, bursaAnnouncementUrl, klseViewUrl } from "@/lib/filing-id";
import { formatKlStamp } from "@/lib/format";
import type { AnnouncementKind, Filing, FilingCategory, FilingsPayload, MarketAnnouncement } from "@/lib/types";

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

function kindFromCategory(category: FilingCategory): AnnouncementKind {
  if (category === "QR") return "financial";
  if (category === "DIV") return "dividend";
  if (category === "BOARD") return "director";
  return "other";
}

function toViewerFiling(item: Filing, activeTicker: string, companyName: string): MarketAnnouncement | null {
  const id = announcementIdFromUrl(item.url ?? item.id);
  if (!id) return null;
  const code = activeTicker.replace(/\.KL$/i, "");
  return {
    id,
    title: item.title,
    company: companyName,
    companyName,
    code,
    symbol: activeTicker,
    shariah: null,
    filingType: item.category,
    kind: kindFromCategory(item.category),
    publishedAt: item.publishedAt,
    url: item.url ?? klseViewUrl(id),
    bursaUrl: bursaAnnouncementUrl(id),
    pdfUrl: null,
    pdfName: null,
    source: item.source,
  };
}

export function FilingsPanel({ payload, error, loading, companyName }: FilingsPanelProps) {
  const activeTicker = payload?.symbol ?? "";
  const items = payload?.items ?? [];
  const [selected, setSelected] = useState<MarketAnnouncement | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [activeTicker]);

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
      {loading && items.length === 0 && !error ? (
        <NewsFeedSkeleton rows={6} />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <FilingRow
              key={item.id}
              item={item}
              activeTicker={activeTicker}
              companyName={companyName}
              onOpen={setSelected}
            />
          ))}
          {items.length === 0 ? (
            <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
              {error
                ? `FILINGS FEED UNAVAILABLE · ${error}`
                : `NO RECENT FILINGS FOR ${companyName.toUpperCase()}`}
            </li>
          ) : null}
        </ul>
      )}
      {selected && activeTicker ? (
        <FilingsModal
          key={`${activeTicker}-${selected.id}`}
          activeTicker={activeTicker}
          activeCompany={companyName}
          selectedFilingId={selected.id}
          selectedFiling={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function FilingRow({
  item,
  activeTicker,
  companyName,
  onOpen,
}: {
  item: Filing;
  activeTicker: string;
  companyName: string;
  onOpen: (filing: MarketAnnouncement) => void;
}) {
  const filing = activeTicker ? toViewerFiling(item, activeTicker, companyName) : null;
  const body = (
    <div className="flex flex-col gap-2 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 font-mono text-[10px] text-zinc-400">{formatKlStamp(item.publishedAt)}</span>
        <span className={`shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${BADGE[item.category]}`}>
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
      <Eli5Block build={() => summariseFiling(item.title, item.category)} subject={item.title} />
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
