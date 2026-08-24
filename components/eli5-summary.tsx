"use client";

import { useState } from "react";
import {
  SENTIMENT_LABEL,
  hasValidSummary,
  isPlaceholderSummary,
  type Eli5Sentiment,
  type Eli5Summary,
  type HeadlineContext,
} from "@/lib/eli5";

const SENTIMENT_CLASS: Record<Eli5Sentiment, string> = {
  positive: "border-gain/50 bg-gain/10 text-gain",
  neutral: "border-line bg-[#1a1a1a] text-neutral-300",
  caution: "border-amber-400/50 bg-amber-400/10 text-amber-300",
};

export type NewsSummaryInput = HeadlineContext & {
  title: string;
  url?: string | null;
};

type Eli5BlockProps = {
  /** Sync builder for filings, DOSM prints and calendar events. */
  build?: () => Eli5Summary | null;
  /** News items go through /api/summarize so scrape/LLM can run. */
  news?: NewsSummaryInput;
  /** Label for screen readers, so the control is not just "Summarize". */
  subject: string;
};

async function fetchNewsSummary(news: NewsSummaryInput): Promise<Eli5Summary | null> {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: news.title,
      snippet: news.snippet ?? null,
      company: news.company ?? null,
      symbol: news.symbol ?? null,
      url: news.url ?? null,
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { summary?: Eli5Summary | null };
  const summary = payload.summary ?? null;
  if (!summary) return null;
  if (isPlaceholderSummary(summary)) return null;
  return summary;
}

/**
 * Collapsed by default and expands in place. If summarization cannot produce
 * a real, non-placeholder explainer, the control is hidden for that item.
 */
export function Eli5Block({ build, news, subject }: Eli5BlockProps) {
  const [summary, setSummary] = useState<Eli5Summary | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const showToggle = Boolean(build) || hasValidSummary(news ?? {});
  if (hidden || !showToggle) return null;

  async function toggle() {
    if (summary) {
      setSummary(null);
      return;
    }

    setBusy(true);
    try {
      const result = news ? await fetchNewsSummary(news) : (build?.() ?? null);
      if (!result || isPlaceholderSummary(result)) {
        setHidden(true);
        return;
      }
      setSummary(result);
    } catch {
      setHidden(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto mt-1">
      {showToggle ? (
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          aria-expanded={summary != null}
          aria-label={
            summary ? `Hide plain-English summary of ${subject}` : `Explain ${subject} in simple terms`
          }
          className={`rounded-sm border px-1.5 py-px font-mono text-[9px] tracking-wider transition-colors ${
            summary
              ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
              : "border-line text-neutral-500 hover:border-amber-400/40 hover:text-amber-300"
          } disabled:opacity-60`}
        >
          {busy ? "✨ SUMMARIZING…" : summary ? "✨ HIDE SUMMARY" : "✨ SUMMARIZE"}
        </button>
      ) : null}

      {summary && showToggle ? (
        <div className="mt-1.5 border border-line bg-[#0a0a0a] p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-neutral-500">
              Key takeaways
            </span>
            <span
              className={`rounded-sm border px-1 py-px font-mono text-[8px] uppercase tracking-wider ${SENTIMENT_CLASS[summary.sentiment]}`}
            >
              {SENTIMENT_LABEL[summary.sentiment]}
            </span>
          </div>

          <dl className="mt-1.5 space-y-1.5">
            <div>
              <dt className="font-mono text-[8px] uppercase tracking-wider text-amber-400/80">
                What happened
              </dt>
              <dd className="text-[11px] leading-snug text-neutral-200">{summary.happened}</dd>
            </div>
            <div>
              <dt className="font-mono text-[8px] uppercase tracking-wider text-amber-400/80">
                Why it matters for shareholders
              </dt>
              <dd className="text-[11px] leading-snug text-neutral-200">{summary.matters}</dd>
            </div>
          </dl>

          <p className="mt-1.5 font-mono text-[8px] leading-relaxed text-neutral-700">
            PLAIN-ENGLISH EXPLAINER · NOT INVESTMENT ADVICE
          </p>
        </div>
      ) : null}
    </div>
  );
}
