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
  /** Filing metadata for the document-carrier fallback panel. */
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
 * Same-origin proxy blob when it works. Never third-party embeds (Bursa WAF
 * blocks them). On 403 / failure, show an in-app document carrier panel.
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

    async function load() {
      try {
        const response = await fetch(pdfUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(45_000),
        });
        if (cancelled) return;

        const blob = await response.blob();
        if (cancelled) return;

        const peek = await blob.slice(0, 512).text().catch(() => "");
        if (isErrorPayload(response, blob, peek)) {
          setMode("panel");
          return;
        }

        const type = (blob.type || response.headers.get("content-type") || "").toLowerCase();
        const looksPdf =
          type.includes("pdf") || type.includes("octet-stream") || (await blobLooksLikePdf(blob));
        if (!looksPdf) {
          setMode("panel");
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
        if (!cancelled) setMode("panel");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfUrl]);

  if (mode === "proxy" && blobUrl) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#121212]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700/80 px-3 py-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Proxy preview
          </span>
          {officialPdfUrl ? (
            <button
              type="button"
              onClick={() => window.open(officialPdfUrl, "_blank", "noopener,noreferrer")}
              className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 hover:underline"
            >
              Open on Bursa ↗
            </button>
          ) : null}
        </div>
        <iframe
          title={title}
          src={blobUrl}
          className="h-full w-full flex-1 border-0 bg-[#121212]"
        />
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-[#121212] px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Fetching filing…
        </p>
        {officialPdfUrl ? (
          <button
            type="button"
            onClick={() => window.open(officialPdfUrl, "_blank", "noopener,noreferrer")}
            className="font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-emerald-400"
          >
            Don&apos;t wait — open on Bursa ↗
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <DocumentCarrierPanel
      title={title}
      companyName={companyName}
      publishedLabel={publishedLabel}
      categoryLabel={categoryLabel}
      officialPdfUrl={officialPdfUrl}
      announcementUrl={announcementUrl}
    />
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8 2h22l12 12v38a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M30 2v10a2 2 0 0 0 2 2h10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 28h20M14 36h20M14 44h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DocumentCarrierPanel({
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
    <div className="flex h-full min-h-0 flex-col bg-[#121212] p-4 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center border border-slate-700/80 bg-[#121212] px-5 py-8 text-center sm:px-8">
        <DocumentIcon className="mb-5 h-14 w-12 text-slate-400" />

        <div className="max-w-md space-y-2">
          <h3 className="text-[15px] font-medium leading-snug text-neutral-100">{title}</h3>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            {categoryLabel}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-300">{companyName}</p>
          <p className="font-mono text-[10px] text-slate-500">{publishedLabel}</p>
        </div>

        <div className="mt-6 flex w-full max-w-sm flex-col gap-2.5">
          {officialPdfUrl ? (
            <button
              type="button"
              onClick={() => window.open(officialPdfUrl, "_blank", "noopener,noreferrer")}
              className="w-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20"
            >
              Open PDF directly on Bursa Malaysia ↗
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.open(announcementUrl, "_blank", "noopener,noreferrer")}
            className="w-full border border-slate-600 bg-slate-900/60 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:border-slate-400 hover:text-gain"
          >
            View Announcement Page on Bursa ↗
          </button>
        </div>
      </div>
    </div>
  );
}
