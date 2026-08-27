"use client";

import { useEffect, useState } from "react";

type FilingPdfViewerProps = {
  /** Same-origin proxy URL (`/api/filings/pdf` or `/api/filings/proxy-pdf`). */
  pdfUrl: string;
  /** Upstream Bursa disclosure URL — opens in the user's browser when the proxy is blocked. */
  upstreamPdfUrl?: string | null;
  title: string;
  downloadHref: string;
};

/**
 * Embed the same-origin proxy in an iframe (local previews used to work this way).
 * Do not abort early — Node fetch often 403s, then curl fallback can take 20–50s.
 */
export function FilingPdfViewer({
  pdfUrl,
  upstreamPdfUrl,
  title,
  downloadHref,
}: FilingPdfViewerProps) {
  const [slow, setSlow] = useState(false);
  const openHref = upstreamPdfUrl ?? downloadHref;

  useEffect(() => {
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [pdfUrl]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          {slow ? "Still fetching from Bursa…" : "Proxy preview"}
        </span>
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 hover:underline"
        >
          Open PDF in browser ↗
        </a>
      </div>

      <iframe
        key={pdfUrl}
        title={title}
        src={pdfUrl}
        className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
      />
    </div>
  );
}
