"use client";

import { useMemo, useState } from "react";
import { Eli5Block } from "@/components/eli5-summary";
import { NewsFeedSkeleton, PanelSkeleton } from "@/components/skeleton";
import { ResponsiveSplit } from "@/components/responsive-split";
import { POLITICS_DESK_TAGS } from "@/lib/categories";
import { hasValidSummary } from "@/lib/eli5";
import { formatKlStamp } from "@/lib/format";
import type { HeadlinesPayload, OfficialPayload } from "@/lib/types";

type PoliticsDeskProps = {
  official: OfficialPayload | null;
  officialError: string | null;
  officialLoading: boolean;
  headlines: HeadlinesPayload | null;
  headlinesError: string | null;
  headlinesLoading: boolean;
};

export function PoliticsDesk({
  official,
  officialError,
  officialLoading,
  headlines,
  headlinesError,
  headlinesLoading,
}: PoliticsDeskProps) {
  const [tag, setTag] = useState<string | null>(null);
  const items = headlines?.category === "my-politics" ? headlines.items : [];
  const tags = useMemo(() => {
    const ordered = [...POLITICS_DESK_TAGS];
    for (const item of items) {
      if (item.tag && !ordered.includes(item.tag)) ordered.push(item.tag);
    }
    return ordered;
  }, [items]);

  const visible = tag ? items.filter((item) => item.tag === tag) : items;
  const desks = official?.desks ?? [];

  return (
    <ResponsiveSplit
      autoSaveId="bursa-politics-layout"
      left={{
        id: "politics-official",
        label: "Official",
        defaultSize: 50,
        minSize: 30,
        content: (
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-line px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Official feed
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Live statements tracked per account — PMO, Ministry of Finance, Bank Negara
          </p>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-2">
          {officialError ? (
            <p className="px-3 py-2 font-mono text-[10px] text-loss">WIRE ERROR · {officialError}</p>
          ) : null}
          {officialLoading && desks.length === 0 ? (
            <PanelSkeleton rows={8} />
          ) : null}
          {desks.map((desk) => (
            <div key={desk.handle} className="border-b border-line">
              <div className="flex items-baseline justify-between gap-3 bg-[#101510] px-3 py-2">
                <div>
                  <p className="font-mono text-[11px] text-gain">{desk.handle}</p>
                  <p className="text-[11px] text-neutral-400">
                    {desk.org} · {desk.blurb}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-neutral-600">{desk.items.length}</span>
              </div>
              <ul className="divide-y divide-line">
                {desk.items.map((item) => (
                  <StoryRow
                    key={item.id}
                    title={item.title}
                    meta={`${item.publisher ?? "Google News"} · ${formatKlStamp(item.publishedAt)} MYT`}
                    url={item.url}
                    compact
                  />
                ))}
                {desk.items.length === 0 ? (
                  <li className="px-3 py-3 font-mono text-[10px] text-neutral-600">NO ITEMS THIS WINDOW</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </section>
        ),
      }}
      right={{
        id: "politics-news",
        label: "News",
        defaultSize: 50,
        minSize: 25,
        content: (
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-line px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Policy news
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            The Edge, Bernama and Malaysiakini · tagged subsidy, JS-SEZ, cabinet and budget
          </p>
        </div>
        {tags.length > 0 ? (
          <div className="flex shrink-0 gap-1 overflow-x-auto scrollbar-none border-b border-line px-3 py-2">
            <TagChip label="ALL" active={tag == null} onClick={() => setTag(null)} />
            {tags.map((name) => (
              <TagChip
                key={name}
                label={name}
                active={tag === name}
                onClick={() => setTag(tag === name ? null : name)}
              />
            ))}
          </div>
        ) : null}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pl-2">
          {headlinesLoading && visible.length === 0 && !headlinesError ? (
            <NewsFeedSkeleton />
          ) : (
          <ul className="divide-y divide-line">
          {visible.map((item) => (
            <StoryRow
              key={item.id}
              title={item.title}
              meta={`${item.publisher ?? "Google News"} · ${formatKlStamp(item.publishedAt)} MYT`}
              url={item.url}
              tag={item.tag}
            />
          ))}
          {visible.length === 0 ? (
            <li className="px-3 py-8 text-center font-mono text-[11px] text-neutral-600">
              {headlinesError
                ? `NEWS FEED UNAVAILABLE · ${headlinesError}`
                : "NO HEADLINES"}
            </li>
          ) : null}
          </ul>
          )}
        </div>
      </section>
        ),
      }}
    />
  );
}

function StoryRow({
  title,
  meta,
  url,
  tag,
  compact = false,
}: {
  title: string;
  meta: string;
  url: string | null;
  tag?: string | null;
  compact?: boolean;
}) {
  return (
    <li className="relative hover:bg-[#161616]">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title} — open story`}
          title={title}
          className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
        />
      ) : null}
      <div className={`pointer-events-none relative z-10 flex flex-col gap-2 px-3 ${compact ? "py-2" : "py-2.5"}`}>
        {tag ? <span className="w-fit font-mono text-[9px] text-gain">{tag}</span> : null}
        <p
          className={`line-clamp-2 min-w-0 overflow-hidden font-medium leading-snug text-neutral-100 ${compact ? "text-[12px]" : "text-[13px]"}`}
          title={title}
        >
          {title}
        </p>
        <p
          className="font-mono text-[9px] uppercase tracking-wider text-zinc-400"
        >
          {meta}
        </p>
        {hasValidSummary({ title }) && (
          <Eli5Block news={{ title, url }} subject={title} />
        )}
      </div>
    </li>
  );
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-sm border px-2.5 font-mono text-[10px] tracking-wider md:min-h-0 md:px-1.5 md:py-px md:text-[9px] ${
        active ? "border-gain/50 bg-gain/10 text-gain" : "border-line text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
