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

type LoadState = "loading" | "ready" | "failed";

function blobLooksLikePdf(blob: Blob): Promise<boolean> {
  return blob.slice(0, 8).arrayBuffer().then((buffer) => {
    const head = new Uint8Array(buffer);
    for (let i = 0; i <= head.length - 5; i++) {
      if (
        head[i] === 0x25 &&
        head[i + 1] === 0x50 &&
        head[i + 2] === 0x44 &&
        head[i + 3] === 0x46 &&
        head[i + 4] === 0x2d
      ) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Loads the same-origin proxy as a blob and embeds it. Bursa blocks Google Docs
 * embeds and often 403s datacenter proxies — never auto-failover to Google.
 */
export function FilingPdfViewer({
  pdfUrl,
  upstreamPdfUrl,
  title,
  downloadHref,
}: FilingPdfViewerProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const openHref = upstreamPdfUrl ?? downloadHref;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState("loading");
    setBlobUrl(null);

    async function load() {
      try {
        const response = await fetch(pdfUrl, { cache: "no-store" });
        if (cancelled) return;

        if (!response.ok) {
          setState("failed");
          return;
        }

        const blob = await response.blob();
        if (cancelled) return;

        const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
        const looksPdf =
          type.includes("pdf") || type.includes("octet-stream") || (await blobLooksLikePdf(blob));
        if (!looksPdf) {
          setState("failed");
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobUrl(objectUrl);
        setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl]);

  if (state === "failed") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
            Preview
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">
            Proxy blocked by Bursa
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            In-app preview unavailable
          </p>
          <p className="max-w-sm text-[12px] leading-snug text-neutral-400">
            Bursa is blocking the server proxy. Open the PDF in Chrome instead — that uses your
            PC&apos;s connection.
          </p>
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20"
          >
            Open PDF in browser ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          {state === "loading" ? "Loading PDF…" : "Proxy preview"}
        </span>
        {upstreamPdfUrl ? (
          <a
            href={upstreamPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] uppercase tracking-wider text-neutral-500 hover:text-gain"
          >
            Open direct ↗
          </a>
        ) : null}
      </div>

      {state === "ready" && blobUrl ? (
        <iframe
          title={title}
          src={blobUrl}
          className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">
            Fetching filing…
          </p>
        </div>
      )}
    </div>
  );
}
