"use client";

import { NEWS_WINDOW_HINT, NEWS_WINDOW_LABEL } from "@/lib/news-window";

export function NewsWindowNotice() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-2.5 py-1.5">
      <span
        title={NEWS_WINDOW_HINT}
        className="inline-flex flex-shrink-0 whitespace-nowrap rounded-sm border border-line bg-[#141414] px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-400"
      >
        {NEWS_WINDOW_LABEL}
      </span>
    </div>
  );
}
