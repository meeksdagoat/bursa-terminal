"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FilingBadge, FilingsModal } from "@/components/FilingsModal";
import { ShowMoreBar } from "@/components/h-scroll";
import { CountPulse, NewsFeedSkeleton } from "@/components/skeleton";
import { formatKlStamp } from "@/lib/format";
import { useLiveData } from "@/lib/use-live-data";
import { useShariahOnly } from "@/lib/use-shariah";
import { terminalHref } from "@/lib/universe";
import type { AnnouncementKind, CompanyFilingsPayload, MarketAnnouncement } from "@/lib/types";

const REFRESH_MS = 2 * 60 * 1000;

const FILTERS: { id: "all" | AnnouncementKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "financial", label: "Financial Results" },
  { id: "dividend", label: "Dividends" },
  { id: "director", label: "Director Changes" },
];

type AnnouncementsDrawerProps = {
  activeTicker: string;
  activeCompany: string;
};

export function AnnouncementsDrawer({ activeTicker, activeCompany }: AnnouncementsDrawerProps) {
  const url = `/api/bursa/filings?symbol=${encodeURIComponent(activeTicker)}`;
  const feed = useLiveData<CompanyFilingsPayload>(url, REFRESH_MS);
  const shariahOnly = useShariahOnly();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [limit, setLimit] = useState(24);
  const [selected, setSelected] = useState<MarketAnnouncement | null>(null);

  const ready = feed.data?.symbol === activeTicker;
  const payload = ready ? feed.data : null;

  useEffect(() => {
    setSelected(null);
    setLimit(24);
  }, [activeTicker]);

  const items = useMemo(() => {
    const rows = payload?.items ?? [];
    const compliant = shariahOnly ? rows.filter((row) => row.shariah !== false) : rows;
    return filter === "all" ? compliant : compliant.filter((row) => row.kind === filter);
  }, [payload?.items, filter, shariahOnly]);

  const visible = items.slice(0, limit);
  const pending = !ready || (feed.loading && !payload);
  const hidden = shariahOnly ? (payload?.items.length ?? 0) - items.length : 0;

  return (
    <aside className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-panel">
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 md:h-7 md:min-h-0">
        <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Bursa filings · {activeTicker}
        </h2>
        <span className={`shrink-0 font-mono text-[9px] ${feed.error ? "text-loss" : "text-neutral-600"}`}>
          {feed.error ? "FEED ERROR" : pending ? <CountPulse /> : items.length}
        </span>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto scrollbar-none border-b border-line px-2 py-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setFilter(option.id);
              setLimit(24);
            }}
            aria-pressed={filter === option.id}
            className={`min-h-11 shrink-0 rounded-sm border px-2.5 font-mono text-[10px] tracking-wider transition-colors md:min-h-0 md:px-1.5 md:py-px md:text-[9px] ${
              filter === option.id
                ? "border-gain/50 bg-gain/10 text-gain"
                : "border-line text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {hidden > 0 ? (
        <p className="shrink-0 border-b border-line bg-[#0d120d] px-2.5 py-1 font-mono text-[9px] text-gain/80">
          SHARIAH ONLY · {hidden} HIDDEN
        </p>
      ) : null}

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {pending ? (
          <NewsFeedSkeleton />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((item) => (
              <AnnouncementRow key={item.id} item={item} onOpen={setSelected} />
            ))}
            {visible.length === 0 ? (
              <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
                {feed.error
                  ? `ANNOUNCEMENTS FEED UNAVAILABLE · ${feed.error}`
                  : filter === "all"
                    ? `NO RECENT BURSA FILINGS FOR ${activeCompany.toUpperCase()}`
                    : `NO ${FILTERS.find((option) => option.id === filter)?.label.toUpperCase()} FOR ${activeTicker}`}
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <ShowMoreBar remaining={items.length - visible.length} onClick={() => setLimit((n) => n + 24)} label="filings" />

      {selected ? (
        <FilingsModal
          key={`${activeTicker}-${selected.id}`}
          activeTicker={activeTicker}
          activeCompany={activeCompany}
          selectedFilingId={selected.id}
          selectedFiling={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </aside>
  );
}

function AnnouncementRow({
  item,
  onOpen,
}: {
  item: MarketAnnouncement;
  onOpen: (item: MarketAnnouncement) => void;
}) {
  return (
    <li className="relative hover:bg-[#161616]">
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`${item.title} — open filing`}
        className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
      />
      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 font-mono text-[10px] text-zinc-400">{formatKlStamp(item.publishedAt)}</span>
          <FilingBadge item={item} />
          {item.symbol ? (
            <span className="pointer-events-auto relative z-10">
              <Link
                href={terminalHref(item.symbol)}
                className="font-mono text-[10px] text-gain hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {item.symbol}
              </Link>
            </span>
          ) : null}
        </div>
        <p className="line-clamp-2 min-w-0 text-[12px] font-medium leading-snug text-neutral-100" title={item.title}>
          {item.title}
        </p>
        <p className="truncate font-mono text-[9px] uppercase tracking-wider text-zinc-400">
          {item.companyName ?? item.company ?? "Bursa Malaysia"}
        </p>
      </div>
    </li>
  );
}
