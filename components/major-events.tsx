"use client";

import { useMemo, useState } from "react";
import { formatEventHeadline, formatKlFullDate } from "@/lib/format";
import {
  EVENT_SENTIMENT_BADGE,
  EVENT_SENTIMENT_LABEL,
  EVENT_TYPE_LABEL,
} from "@/lib/event-classify";
import type { CorporateEvent, CorporateEventsPayload, EventSentiment } from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 5 * 60 * 1000;

const EFFECT_OPTIONS: EventSentiment[] = ["positive", "neutral", "negative"];

const EFFECT_OPTION_CLASS: Record<EventSentiment, string> = {
  positive: "text-gain",
  neutral: "text-amber-300",
  negative: "text-loss",
};

const SOURCE_LABEL: Record<CorporateEventsPayload["source"], string> = {
  "bursa+news": "BURSA + NEWS",
  bursa: "BURSA FILINGS",
  news: "COMPANY NEWS",
};

const SELECT_CLASS =
  "h-8 rounded border border-neutral-800 bg-[#141414] px-2 py-1 font-mono text-xs text-neutral-300 md:h-6";

type MajorEventsProps = {
  symbol: string;
  companyName: string;
};

export function MajorEvents({ symbol, companyName }: MajorEventsProps) {
  const [year, setYear] = useState<string>("all");
  const [effect, setEffect] = useState<string>("all");
  const url = `/api/events?symbol=${encodeURIComponent(symbol)}`;
  const { data, error, loading } = useLiveData<CorporateEventsPayload>(url, REFRESH_MS);

  const ready = data?.symbol === symbol;
  const payload = ready ? data : null;
  const pending = !ready || (loading && !payload);
  const items = payload?.items ?? [];

  const years = useMemo(() => {
    const values = new Set<number>();
    for (const item of items) {
      const parsed = new Date(item.date).getUTCFullYear();
      if (Number.isFinite(parsed)) values.add(parsed);
    }
    return [...values].sort((a, b) => b - a);
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const itemYear = String(new Date(item.date).getUTCFullYear());
        if (year !== "all" && itemYear !== year) return false;
        if (effect !== "all" && item.sentiment !== effect) return false;
        return true;
      }),
    [items, year, effect],
  );

  if (error && !payload) {
    return <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">EVENTS FEED UNAVAILABLE · {error}</p>;
  }
  if (pending) {
    return (
      <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
        LOADING {companyName.toUpperCase()} EVENT TIMELINE…
      </p>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
        <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Year
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All years</option>
            {years.map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Effects
          <select
            value={effect}
            onChange={(event) => setEffect(event.target.value)}
            className={`${SELECT_CLASS} ${effect === "all" ? "" : EFFECT_OPTION_CLASS[effect as EventSentiment]}`}
          >
            <option value="all">All effects</option>
            {EFFECT_OPTIONS.map((value) => (
              <option key={value} value={value} className={EFFECT_OPTION_CLASS[value]}>
                {EVENT_SENTIMENT_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-neutral-700">
          LIVE · {payload ? SOURCE_LABEL[payload.source] : "TIMELINE"} · {visible.length}
        </span>
      </div>

      <ol className="min-w-0 divide-y divide-line">
        {visible.map((item) => (
          <EventRow key={item.id} item={item} />
        ))}
        {visible.length === 0 ? (
          <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
            {items.length === 0
              ? `NO LIVE FILINGS OR NEWS FOR ${companyName.toUpperCase()}`
              : "NO EVENTS MATCH THE YEAR / EFFECTS FILTERS"}
          </li>
        ) : null}
      </ol>
    </div>
  );
}

function EventRow({ item }: { item: CorporateEvent }) {
  const headline = formatEventHeadline(item.title);
  const body = (
    <div className="min-w-0 overflow-hidden px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-[74px] shrink-0 font-mono text-[10px] text-neutral-500">
          {formatKlFullDate(item.date)}
        </span>
        <SentimentBadge sentiment={item.sentiment} />
        <span className="shrink-0 rounded-sm border border-line px-1 py-px font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          {EVENT_TYPE_LABEL[item.type]}
        </span>
      </div>
      <p
        className="mt-1 line-clamp-2 min-w-0 overflow-hidden break-words text-[12px] font-medium leading-snug text-neutral-100"
        title={item.title}
      >
        {headline}
      </p>
      {item.summary ? (
        <p className="mt-0.5 min-w-0 text-[11px] leading-snug text-neutral-400">{item.summary}</p>
      ) : null}
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-700">
        {item.source}
        {item.url ? " ↗" : ""}
      </p>
    </div>
  );

  if (!item.url) return <li className="min-w-0">{body}</li>;

  return (
    <li className="relative min-w-0 hover:bg-[#161616]">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={item.title}
        aria-label={`${headline} — open source`}
        className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
      />
      <div className="pointer-events-none relative z-10 min-w-0">{body}</div>
    </li>
  );
}

function SentimentBadge({ sentiment }: { sentiment: EventSentiment }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${EVENT_SENTIMENT_BADGE[sentiment]}`}
    >
      {EVENT_SENTIMENT_LABEL[sentiment]}
    </span>
  );
}
