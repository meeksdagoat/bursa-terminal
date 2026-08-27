"use client";

import { useEffect, useState } from "react";

type FilingPdfViewerProps = {
  /** Same-origin proxy URL (`/api/filings/pdf`). */
  pdfUrl: string;
  /** Upstream Bursa disclosure PDF URL. */
  upstreamPdfUrl?: string | null;
  /** Document / PDF display name. */
  title: string;
  downloadHref: string;
  /** Filing metadata for the interactive fallback panel. */
  companyName: string;
  publishedLabel: string;
  categoryLabel: string;
  /** Bursa announcement details page (not the raw PDF). */
  announcementUrl: string;
};

type ViewMode = "loading" | "proxy" | "panel";

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

function isErrorPayload(response: Response, blob: Blob, peek: string): boolean {
  const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok) return true;
  if (type.includes("json") || type.includes("text/plain") || type.includes("text/html")) return true;
  if (/UPSTREAM_FORBIDDEN|Upstream PDF responded 403|"error"\s*:/i.test(peek)) return true;
  return false;
}

/**
 * Prefer the same-origin proxy (works on local). Never embed Google Docs gview
 * (also blocked by Bursa). Never render JSON errors in an iframe. On failure,
 * show an Interactive Filing Panel that opens Bursa in the user's browser.
 */
export function FilingPdfViewer({
  pdfUrl,
  upstreamPdfUrl,
  title,
  downloadHref,
  companyName,
  publishedLabel,
  categoryLabel,
  announcementUrl,
}: FilingPdfViewerProps) {
  const [mode, setMode] = useState<ViewMode>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const officialPdfUrl = upstreamPdfUrl ?? downloadHref;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setMode("loading");
    setBlobUrl(null);

    async function tryProxy(): Promise<boolean> {
      const response = await fetch(pdfUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
      if (cancelled) return false;

      const blob = await response.blob();
      if (cancelled) return false;

      const peek = await blob.slice(0, 512).text().catch(() => "");
      if (isErrorPayload(response, blob, peek)) return false;

      const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
      const looksPdf =
        type.includes("pdf") || type.includes("octet-stream") || (await blobLooksLikePdf(blob));
      if (!looksPdf) return false;

      objectUrl = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return false;
      }
      setBlobUrl(objectUrl);
      setMode("proxy");
      return true;
    }

    /** Browser-side fetch of Bursa — usually CORS-blocked; succeed only if a PDF blob returns. */
    async function tryClientUpstream(): Promise<boolean> {
      if (!officialPdfUrl) return false;
      try {
        const response = await fetch(officialPdfUrl, {
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
          signal: AbortSignal.timeout(20_000),
        });
        if (cancelled || !response.ok) return false;
        const blob = await response.blob();
        if (cancelled) return false;
        const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
        const looksPdf =
          type.includes("pdf") || type.includes("octet-stream") || (await blobLooksLikePdf(blob));
        if (!looksPdf) return false;
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return false;
        }
        setBlobUrl(objectUrl);
        setMode("proxy");
        return true;
      } catch {
        return false;
      }
    }

    async function load() {
      try {
        if (await tryProxy()) return;
        if (await tryClientUpstream()) return;
      } catch {
        // Fall through to panel.
      }
      if (!cancelled) setMode("panel");
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl, officialPdfUrl]);

  if (mode === "proxy" && blobUrl) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
            Proxy preview
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
        <iframe
          title={title}
          src={blobUrl}
          className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
        />
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-[#0d0d0d] px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">
          Fetching filing…
        </p>
        {officialPdfUrl ? (
          <button
            type="button"
            onClick={() => window.open(officialPdfUrl, "_blank", "noopener,noreferrer")}
            className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 hover:text-emerald-400"
          >
            Don&apos;t wait — open on Bursa ↗
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <InteractiveFilingPanel
      title={title}
      companyName={companyName}
      publishedLabel={publishedLabel}
      categoryLabel={categoryLabel}
      officialPdfUrl={officialPdfUrl}
      announcementUrl={announcementUrl}
    />
  );
}

function InteractiveFilingPanel({
  title,
  companyName,
  publishedLabel,
  categoryLabel,
  officialPdfUrl,
  announcementUrl,
}: {
  title: string;
  companyName: string;
  publishedLabel: string;
  categoryLabel: string;
  officialPdfUrl: string;
  announcementUrl: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center border-b border-neutral-800 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Interactive filing panel
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
        <div className="max-w-md space-y-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400/90">
            Official disclosure
          </p>
          <h3 className="text-[15px] font-medium leading-snug text-neutral-100">{title}</h3>
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            {companyName}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-400">
              {categoryLabel}
            </span>
            <span className="font-mono text-[10px] text-neutral-500">{publishedLabel}</span>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2">
          {officialPdfUrl ? (
            <button
              type="button"
              onClick={() => window.open(officialPdfUrl, "_blank", "noopener,noreferrer")}
              className="w-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20"
            >
              Open PDF directly on Bursa Malaysia ↗
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.open(announcementUrl, "_blank", "noopener,noreferrer")}
            className="w-full border border-neutral-700 bg-neutral-900/80 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:border-neutral-500 hover:text-gain"
          >
            View Announcement Page on Bursa ↗
          </button>
        </div>

        <p className="max-w-sm text-[12px] leading-snug text-neutral-400">
          Bursa Malaysia restricts direct server embedding. Click above to view the official PDF in a
          new tab.
        </p>
      </div>
    </div>
  );
}
