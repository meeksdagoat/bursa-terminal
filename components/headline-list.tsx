"use client";

import { useMemo, useState } from "react";
import { Eli5Block } from "@/components/eli5-summary";
import { CountPulse, NewsFeedSkeleton } from "@/components/skeleton";
import { NewsWindowNotice } from "@/components/news-window-notice";
import { HEADLINE_CATEGORIES, type HeadlineCategory } from "@/lib/categories";
import { hasValidSummary } from "@/lib/eli5";
import { formatKlStamp } from "@/lib/format";
import { textIsShariahSafe } from "@/lib/shariah";
import type { HeadlinesPayload } from "@/lib/types";
import { useShariahOnly } from "@/lib/use-shariah";

type HeadlineListProps = {
  category: HeadlineCategory;
  payload: HeadlinesPayload | null;
  error: string | null;
  loading: boolean;
  /** Topic badges to offer first, so a desk always shows its promised filters. */
  pinnedTags?: string[];
  /** Overrides the category label in the pane heading. */
  heading?: string;
};

export function HeadlineList({
  category,
  payload,
  error,
  loading,
  pinnedTags = [],
  heading,
}: HeadlineListProps) {
  const meta = HEADLINE_CATEGORIES.find((entry) => entry.id === category);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // The payload can trail a tab click by one render, so the previous desk's
  // headlines are held back rather than shown under the new heading.
  const current = payload?.category === category ? payload : null;
  const all = current?.items ?? [];

  const shariahOnly = useShariahOnly();
  const items = useMemo(
    () => (shariahOnly ? all.filter((item) => textIsShariahSafe(item.title)) : all),
    [all, shariahOnly],
  );
  const hidden = all.length - items.length;

  const tags = useMemo(() => {
    const ordered = [...pinnedTags];
    for (const item of items) {
      if (item.tag && !ordered.includes(item.tag)) ordered.push(item.tag);
    }
    return ordered;
  }, [items, pinnedTags]);

  const visible = activeTag ? items.filter((item) => item.tag === activeTag) : items;
  const pending = (loading || current == null) && visible.length === 0 && !error;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-panel px-3 py-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            {heading ?? meta?.label ?? category}
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">{meta?.blurb}</p>
        </div>
        <span className={`font-mono text-[10px] ${error ? "text-loss" : "text-neutral-600"}`}>
          {error ? (
            "FEED ERROR"
          ) : pending ? (
            <CountPulse />
          ) : (
            `GOOGLE NEWS · ${items.length} STORIES${hidden > 0 ? ` · ${hidden} HIDDEN BY SHARIAH FILTER` : ""}`
          )}
        </span>
      </div>

      <NewsWindowNotice />

      {tags.length > 0 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto scrollbar-none border-b border-line px-3 py-2">
          <TagChip label="ALL" active={activeTag == null} onClick={() => setActiveTag(null)} />
          {tags.map((tag) => (
            <TagChip
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            />
          ))}
        </div>
      ) : null}

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {pending ? (
          <NewsFeedSkeleton />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((item) => (
              <li key={item.id} className="relative hover:bg-[#161616]">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.title} — open story`}
                    title={item.title}
                    className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
                  />
                ) : null}
                <div className="pointer-events-none relative z-10 flex flex-col gap-2 px-3 py-2.5">
                  <HeadlineBody
                    title={item.title}
                    publisher={item.publisher}
                    publishedAt={item.publishedAt}
                    tag={item.tag}
                    linked={Boolean(item.url)}
                  />
                  {hasValidSummary(item) && (
                    <Eli5Block
                      news={{ title: item.title, snippet: item.snippet, url: item.url }}
                      subject={item.title}
                    />
                  )}
                </div>
              </li>
            ))}

            {visible.length === 0 ? (
              <li className="px-3 py-8 text-center font-mono text-[11px] leading-relaxed text-neutral-600">
                {error
                  ? "NEWS FEED TEMPORARILY UNAVAILABLE"
                  : activeTag
                    ? `NO STORIES TAGGED ${activeTag}`
                    : "NO HEADLINES IN THE PAST 365 DAYS"}
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  );
}

function HeadlineBody({
  title,
  publisher,
  publishedAt,
  tag,
  linked = false,
}: {
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  tag: string | null;
  linked?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {tag ? (
        <span className="w-fit shrink-0 font-mono text-[9px] text-gain">{tag}</span>
      ) : null}
      <p
        className="line-clamp-2 min-w-0 overflow-hidden text-[13px] font-medium leading-snug text-neutral-100"
        title={title}
      >
        {title}
      </p>
      <p className="flex min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
        <span className="truncate">{publisher ?? "Google News"}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{formatKlStamp(publishedAt)} MYT</span>
        {linked ? (
          <span aria-hidden className="text-neutral-700">
            ↗
          </span>
        ) : null}
      </p>
    </div>
  );
}

function TagChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-sm border px-2.5 font-mono text-[10px] tracking-wider transition-colors md:min-h-0 md:px-1.5 md:py-px md:text-[9px] ${
        active
          ? "border-gain/50 bg-gain/10 text-gain"
          : "border-line text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
