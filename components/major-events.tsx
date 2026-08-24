"use client";

import { useMemo, useState } from "react";
import { formatKlFullDate } from "@/lib/format";
import type {
  CorporateEvent,
  CorporateEventType,
  CorporateEventsPayload,
  EventImpact,
  EventSentiment,
} from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 30 * 60 * 1000;

const TYPE_LABEL: Record<CorporateEventType, string> = {
  layoffs: "Layoffs",
  ma: "M&A",
  management: "Management",
  expansion: "Expansion",
  contract: "Contract",
  regulatory: "Regulatory",
};

const TYPE_OPTIONS: CorporateEventType[] = [
  "layoffs",
  "ma",
  "management",
  "expansion",
  "contract",
  "regulatory",
];

const IMPACT_LABEL: Record<EventImpact, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

const SENTIMENT_LABEL: Record<EventSentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

const BADGE: Record<EventSentiment, string> = {
  positive: "border-gain/45 bg-gain/10 text-gain",
  negative: "border-loss/45 bg-loss/10 text-loss",
  neutral: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

type MajorEventsProps = {
  symbol: string;
  companyName: string;
};

export function MajorEvents({ symbol, companyName }: MajorEventsProps) {
  const [year, setYear] = useState<string>("all");
  const [type, setType] = useState<string>("all");
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
        if (type !== "all" && item.type !== type) return false;
        return true;
      }),
    [items, year, type],
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
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
        <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Year
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-8 border border-line bg-[#0e0e0e] px-1.5 font-mono text-[10px] text-neutral-200 md:h-6"
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
          Type
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-8 border border-line bg-[#0e0e0e] px-1.5 font-mono text-[10px] text-neutral-200 md:h-6"
          >
            <option value="all">All types</option>
            {TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-neutral-700">
          {payload?.source === "stub" ? "STUB TIMELINE · SWAP /api/events" : "LIVE TIMELINE"} · {visible.length}
        </span>
      </div>

      <ol className="divide-y divide-line">
        {visible.map((item) => (
          <EventRow key={item.id} item={item} />
        ))}
        {visible.length === 0 ? (
          <li className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
            {items.length === 0
              ? `NO MATERIAL EVENTS FOR ${companyName.toUpperCase()}`
              : "NO EVENTS MATCH THE YEAR / TYPE FILTERS"}
          </li>
        ) : null}
      </ol>
    </div>
  );
}

function EventRow({ item }: { item: CorporateEvent }) {
  return (
    <li className="px-2.5 py-2 hover:bg-[#161616]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-[74px] shrink-0 font-mono text-[10px] text-neutral-500">
          {formatKlFullDate(item.date)}
        </span>
        <ImpactBadge impact={item.impact} sentiment={item.sentiment} />
        <span className="rounded-sm border border-line px-1 py-px font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          {TYPE_LABEL[item.type]}
        </span>
        <span className="min-w-0 text-[12px] font-medium leading-snug text-neutral-100">{item.title}</span>
      </div>
      <p className="mt-0.5 pl-0 text-[11px] leading-snug text-neutral-400 sm:pl-[82px]">{item.summary}</p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-700 sm:pl-[82px]">
        {item.source}
      </p>
    </li>
  );
}

function ImpactBadge({
  impact,
  sentiment,
}: {
  impact: EventImpact;
  sentiment: EventSentiment;
}) {
  return (
    <span
      className={`shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${BADGE[sentiment]}`}
    >
      {IMPACT_LABEL[impact]} — {SENTIMENT_LABEL[sentiment]}
    </span>
  );
}
