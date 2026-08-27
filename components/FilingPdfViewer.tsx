"use client";

import { useEffect, useState } from "react";
import { googleDocsPdfViewerUrl } from "@/lib/filing-id";

type FilingPdfViewerProps = {
  /** Same-origin proxy URL (`/api/filings/pdf` or `/api/filings/proxy-pdf`). */
  pdfUrl: string;
  /** Upstream Bursa disclosure URL — used for Google Docs embed + direct open. */
  upstreamPdfUrl?: string | null;
  title: string;
  downloadHref: string;
};

type ViewMode = "loading" | "proxy" | "google" | "actions";

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

async function isUpstreamForbidden(response: Response, blob: Blob): Promise<boolean> {
  const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
  const looksLikeErrorBody = type.includes("json") || type.includes("text");

  if (response.status === 403 || response.status === 502 || !response.ok) {
    if (!looksLikeErrorBody) return !response.ok;
    try {
      const text = await blob.slice(0, 2048).text();
      if (/UPSTREAM_FORBIDDEN|Upstream PDF responded 403|"code"\s*:\s*"UPSTREAM_FORBIDDEN"/i.test(text)) {
        return true;
      }
      if (/403|forbidden/i.test(text)) return true;
    } catch {
      return true;
    }
    return true;
  }

  // Proxy must never surface JSON/text errors as a "PDF" iframe.
  return looksLikeErrorBody;
}

/**
 * Never render proxy JSON errors in the iframe. On Vercel 403, fall back to
 * Google Docs gview (Google fetches Bursa), then surface Bursa open/download CTAs.
 */
export function FilingPdfViewer({
  pdfUrl,
  upstreamPdfUrl,
  title,
  downloadHref,
}: FilingPdfViewerProps) {
  const [mode, setMode] = useState<ViewMode>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [googleStale, setGoogleStale] = useState(false);
  const officialPdfUrl = upstreamPdfUrl ?? downloadHref;
  const googleUrl = upstreamPdfUrl ? googleDocsPdfViewerUrl(upstreamPdfUrl) : null;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setMode("loading");
    setBlobUrl(null);
    setGoogleStale(false);

    async function load() {
      try {
        const response = await fetch(pdfUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(45_000),
        });
        if (cancelled) return;

        const blob = await response.blob();
        if (cancelled) return;

        if (await isUpstreamForbidden(response, blob)) {
          setMode(googleUrl ? "google" : "actions");
          return;
        }

        if (!response.ok) {
          setMode(googleUrl ? "google" : "actions");
          return;
        }

        const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
        // Never put JSON / plain-text error bodies into the iframe.
        if (type.includes("json") || type.includes("text/plain") || type.includes("text/html")) {
          setMode(googleUrl ? "google" : "actions");
          return;
        }

        const looksPdf =
          type.includes("pdf") || type.includes("octet-stream") || (await blobLooksLikePdf(blob));
        if (!looksPdf) {
          setMode(googleUrl ? "google" : "actions");
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobUrl(objectUrl);
        setMode("proxy");
      } catch {
        if (!cancelled) setMode(googleUrl ? "google" : "actions");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl, googleUrl]);

  useEffect(() => {
    if (mode !== "google") {
      setGoogleStale(false);
      return;
    }
    const timer = window.setTimeout(() => setGoogleStale(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [mode, googleUrl]);

  const showActions = mode === "actions" || mode === "google" || mode === "loading";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          {mode === "loading"
            ? "Loading proxy…"
            : mode === "proxy"
              ? "Proxy preview"
              : mode === "google"
                ? "Google Docs preview"
                : "Preview unavailable"}
        </span>
        {officialPdfUrl ? (
          <a
            href={officialPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 hover:underline"
          >
            Open on Bursa ↗
          </a>
        ) : null}
      </div>

      {mode === "proxy" && blobUrl ? (
        <iframe
          title={title}
          src={blobUrl}
          className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
        />
      ) : null}

      {mode === "google" && googleUrl ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <iframe
            key={googleUrl}
            title={title}
            src={googleUrl}
            className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
          />
          {googleStale ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-16">
              <div className="pointer-events-auto">
                <ActionBar officialPdfUrl={officialPdfUrl} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "loading" || mode === "actions" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          {mode === "loading" ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">
              Fetching filing…
            </p>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
                Proxy blocked by Bursa WAF
              </p>
              <p className="max-w-sm text-[12px] leading-snug text-neutral-400">
                Cloud servers cannot fetch this disclosure. Open or download the official PDF
                directly from Bursa Malaysia.
              </p>
            </>
          )}
          {showActions && mode !== "loading" ? <ActionBar officialPdfUrl={officialPdfUrl} /> : null}
          {mode === "loading" && officialPdfUrl ? (
            <a
              href={officialPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 hover:text-emerald-400"
            >
              Don&apos;t wait — open on Bursa ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {mode === "google" && !googleStale ? (
        <div className="shrink-0 border-t border-neutral-800 px-3 py-2">
          <ActionBar officialPdfUrl={officialPdfUrl} compact />
        </div>
      ) : null}
    </div>
  );
}

function ActionBar({
  officialPdfUrl,
  compact = false,
}: {
  officialPdfUrl: string;
  compact?: boolean;
}) {
  if (!officialPdfUrl) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 ${compact ? "" : "mt-1"}`}
    >
      <a
        href={officialPdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20"
      >
        Open PDF directly on Bursa Malaysia ↗
      </a>
      <a
        href={officialPdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="border border-neutral-700 bg-neutral-900/80 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:border-neutral-500 hover:text-gain"
      >
        Download Official PDF ↗
      </a>
    </div>
  );
}
