"use client";

import { useEffect, useState } from "react";
import { googleDocsPdfViewerUrl } from "@/lib/filing-id";

type PreviewMode = "proxy" | "google";

type FilingPdfViewerProps = {
  /** Same-origin proxy URL (`/api/filings/pdf` or `/api/filings/proxy-pdf`). */
  pdfUrl: string;
  /** Upstream Bursa disclosure URL — used only for the Google Docs fallback. */
  upstreamPdfUrl?: string | null;
  title: string;
  downloadHref: string;
};

/**
 * Same-origin PDF iframe. Do not sniff iframe contentDocument — Chrome's PDF
 * text layer often contains phrases like "not allowed" that falsely trip
 * failover to Google Docs (which Bursa blocks), leaving a black pane.
 */
export function FilingPdfViewer({
  pdfUrl,
  upstreamPdfUrl,
  title,
  downloadHref,
}: FilingPdfViewerProps) {
  const [mode, setMode] = useState<PreviewMode>("proxy");
  const [proxyFailed, setProxyFailed] = useState(false);
  const [blankHint, setBlankHint] = useState(false);
  const googleUrl = upstreamPdfUrl ? googleDocsPdfViewerUrl(upstreamPdfUrl) : null;
  const src = mode === "google" && googleUrl ? googleUrl : pdfUrl;

  useEffect(() => {
    setMode("proxy");
    setProxyFailed(false);
    setBlankHint(false);

    // If the proxy never paints, surface a download hint after a short wait.
    const timer = window.setTimeout(() => setBlankHint(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [pdfUrl]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <PreviewTab
            label="Proxy preview"
            active={mode === "proxy"}
            onSelect={() => {
              setMode("proxy");
              setProxyFailed(false);
            }}
          />
          {googleUrl ? (
            <PreviewTab
              label="Google viewer"
              active={mode === "google"}
              onSelect={() => setMode("google")}
            />
          ) : null}
        </div>
        {proxyFailed ? (
          <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">
            Proxy failed · try Download PDF
          </span>
        ) : blankHint ? (
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] uppercase tracking-wider text-neutral-500 hover:text-gain"
          >
            Blank? Download PDF ↗
          </a>
        ) : null}
      </div>

      <iframe
        key={src}
        title={title}
        src={src}
        className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
        onError={() => {
          if (mode === "proxy") {
            setProxyFailed(true);
            if (googleUrl) setMode("google");
          }
        }}
      />

      <p className="sr-only">If the preview stays blank, use Download PDF: {downloadHref}</p>
    </div>
  );
}

function PreviewTab({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-9 px-2 font-mono text-[9px] uppercase tracking-wider md:min-h-0 ${
        active ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}
