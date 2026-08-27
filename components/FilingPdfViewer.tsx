"use client";

type FilingPdfViewerProps = {
  /** Upstream Bursa disclosure PDF URL — only set when a real attachment exists. */
  upstreamPdfUrl?: string | null;
  /** Document / PDF display name. */
  title: string;
  companyName: string;
  publishedLabel: string;
  categoryLabel: string;
  /** Working announcement page (prefer KLSE / explicit filing URL). */
  announcementUrl: string;
};

/**
 * In-app document carrier. Open PDF only when a real disclosure URL exists;
 * otherwise send users to the announcement page (no fake #attachment links).
 */
export function FilingPdfViewer({
  upstreamPdfUrl,
  title,
  companyName,
  publishedLabel,
  categoryLabel,
  announcementUrl,
}: FilingPdfViewerProps) {
  const hasPdf = Boolean(upstreamPdfUrl);

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
          {hasPdf ? (
            <button
              type="button"
              onClick={() => window.open(upstreamPdfUrl!, "_blank", "noopener,noreferrer")}
              className="w-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20"
            >
              Open PDF on Bursa Malaysia ↗
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.open(announcementUrl, "_blank", "noopener,noreferrer")}
            className={`w-full px-4 py-3 font-mono text-[10px] uppercase tracking-wider ${
              hasPdf
                ? "border border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-400 hover:text-gain"
                : "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            View Official Filing Page ↗
          </button>
        </div>
      </div>
    </div>
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
