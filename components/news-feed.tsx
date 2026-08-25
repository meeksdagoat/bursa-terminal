"use client";

import { memo, useMemo, useState } from "react";
import { Eli5Block } from "@/components/eli5-summary";
import { ShowMoreBar } from "@/components/h-scroll";
import { CountPulse, NewsFeedSkeleton } from "@/components/skeleton";
import { hasValidSummary } from "@/lib/eli5";
import { formatKlStamp } from "@/lib/format";
import { textIsShariahSafe } from "@/lib/shariah";
import type { NewsPayload } from "@/lib/types";
import { useShariahOnly } from "@/lib/use-shariah";

export type NewsScope = "company" | "market";

type NewsFeedProps = {
  payload: NewsPayload | null;
  error: string | null;
  loading: boolean;
  scope: NewsScope;
  onScopeChange: (scope: NewsScope) => void;
  /** Name of the charted company, used as the heading while scoped to it. */
  companyName: string;
  companySymbol?: string | null;
};

function NewsFeedInner({
  payload,
  error,
  loading,
  scope,
  onScopeChange,
  companyName,
  companySymbol = null,
}: NewsFeedProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [limit, setLimit] = useState(32);

  const shariahOnly = useShariahOnly();

  const all = useMemo(() => payload?.items ?? [], [payload]);
  const tags = payload?.tags ?? [];

  // Headlines carry no ticker, so compliance is resolved from the companies the
  // headline names; macro and index stories name none and stay visible.
  const items = useMemo(
    () => (shariahOnly ? all.filter((item) => textIsShariahSafe(item.headline)) : all),
    [all, shariahOnly],
  );

  const visible = useMemo(
    () => (activeTag ? items.filter((item) => item.tag === activeTag) : items),
    [items, activeTag],
  );
  const shown = visible.slice(0, limit);

  const company = scope === "company";
  const hidden = all.length - items.length;

  const pending = loading && shown.length === 0 && !error;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-line px-2.5 md:h-7 md:min-h-0">
        <h2 className="truncate text-[10px] font-semibold tracking-[0.16em] text-amber-400/90 uppercase">
          {company ? `${companyName} News` : "Local Market News"}
        </h2>
        <span className={`shrink-0 font-mono text-[9px] ${error ? "text-loss" : "text-neutral-600"}`}>
          {error ? "FEED ERROR" : pending ? <CountPulse /> : items.length}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-px border-b border-line px-2 py-1.5">
        <ScopeButton active={company} onClick={() => onScopeChange("company")} label="This Company" />
        <ScopeButton active={!company} onClick={() => onScopeChange("market")} label="All Market" />
      </div>

      {hidden > 0 ? (
        <p className="shrink-0 border-b border-line bg-[#0d120d] px-2.5 py-1 font-mono text-[9px] text-gain/80">
          SHARIAH ONLY · {hidden} HIDDEN
        </p>
      ) : null}

      {tags.length > 0 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto scrollbar-none border-b border-line px-2 py-1.5">
          <TagChip label="ALL" active={activeTag === null} onClick={() => setActiveTag(null)} />
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
            {shown.map((item) => (
              <li key={item.id} className="relative hover:bg-[#161616]">
                {item.url ? (
                  // Stretched link: the card is clickable while the tag button below
                  // stays interactive, without nesting a button inside an anchor.
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.headline} — open on ${item.source}`}
                    title={item.headline}
                    className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
                  />
                ) : null}

                <div className="pointer-events-none relative z-10 flex flex-col gap-2 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTag(activeTag === item.tag ? null : item.tag)}
                      title={`Filter by ${item.tag}`}
                      className={`pointer-events-auto shrink-0 rounded-sm px-1 font-mono text-[9px] transition-colors ${
                        activeTag === item.tag
                          ? "bg-gain/15 text-gain"
                          : "text-gain hover:bg-gain/10"
                      }`}
                    >
                      {item.tag}
                    </button>
                    <span className="shrink-0 font-mono text-[9px] text-zinc-400">
                      {formatKlStamp(item.publishedAt)}
                    </span>
                  </div>

                  <p
                    className="line-clamp-2 min-w-0 overflow-hidden text-[12px] font-medium leading-snug text-neutral-100"
                    title={item.headline}
                  >
                    {item.headline}
                  </p>

                  <p className="flex min-w-0 items-center gap-2 text-[9px] uppercase tracking-wider text-zinc-400">
                    <span className="truncate">{item.source}</span>
                    {item.url ? <span aria-hidden className="text-neutral-700">↗</span> : null}
                  </p>

                  {hasValidSummary(item) && (
                    <Eli5Block
                      news={{
                        title: item.headline,
                        snippet: item.snippet,
                        url: item.url,
                        company: company ? companyName : null,
                        symbol: company ? companySymbol : null,
                      }}
                      subject={item.headline}
                    />
                  )}
                </div>
              </li>
            ))}

            {visible.length === 0 ? (
              <li className="px-2.5 py-3 font-mono text-[10px] leading-relaxed text-neutral-600">
                {error
                  ? `NEWS FEED UNAVAILABLE · ${error}`
                  : hidden > 0 && items.length === 0
                    ? "EVERY HEADLINE HERE NAMES A NON-COMPLIANT STOCK"
                    : activeTag
                    ? `NO HEADLINES TAGGED ${activeTag}`
                    : company
                      ? `NO RECENT COVERAGE OF ${companyName.toUpperCase()}`
                      : "NO HEADLINES RETURNED"}
              </li>
            ) : null}
          </ul>
        )}
      </div>
      <ShowMoreBar
        remaining={visible.length - shown.length}
        onClick={() => setLimit((n) => n + 32)}
        label="headlines"
      />
    </aside>
  );
}

export const NewsFeed = memo(NewsFeedInner);

function ScopeButton({
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
      aria-pressed={active}
      className={`min-h-11 flex-1 border px-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors md:min-h-0 md:py-0.5 md:text-[9px] ${
        active
          ? "border-gain/50 bg-gain/10 text-gain"
          : "border-line text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
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
