"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKlStamp } from "@/lib/format";
import { filingPdfPath } from "@/lib/filing-id";
import { FilingPdfViewer } from "@/components/FilingPdfViewer";
import { terminalHref } from "@/lib/universe";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { AnnouncementDetailPayload, MarketAnnouncement } from "@/lib/types";

export function FilingBadge({ item }: { item: Pick<MarketAnnouncement, "kind" | "filingType" | "title"> }) {
  const tone =
    item.kind === "dividend"
      ? "border-gain/40 bg-gain/10 text-gain"
      : item.kind === "financial"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
        : item.kind === "director"
          ? "border-violet-400/40 bg-violet-400/10 text-violet-300"
          : "border-line text-neutral-500";
  const label =
    item.kind === "dividend"
      ? "DIV"
      : item.kind === "financial"
        ? /quarterly/i.test(`${item.filingType} ${item.title}`)
          ? "QR"
          : "FA"
        : item.filingType;

  return (
    <span className={`shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${tone}`}>
      {label}
    </span>
  );
}

type FilingsModalProps = {
  activeTicker: string;
  activeCompany: string;
  selectedFilingId: string;
  selectedFiling: MarketAnnouncement;
  onClose: () => void;
};

export function FilingsModal({
  activeTicker,
  activeCompany,
  selectedFilingId,
  selectedFiling,
  onClose,
}: FilingsModalProps) {
  const [detail, setDetail] = useState<AnnouncementDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useBodyScrollLock(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/announcements/${encodeURIComponent(selectedFilingId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Request failed (${response.status})`;
          throw new Error(message);
        }
        return payload as AnnouncementDetailPayload;
      })
      .then((payload) => {
        if (payload.symbol && payload.symbol !== activeTicker) {
          throw new Error(`Filing belongs to ${payload.symbol}, not ${activeTicker}`);
        }
        setDetail(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Detail request failed");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [activeTicker, selectedFilingId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const belongsToTicker = !detail?.symbol || detail.symbol === activeTicker;
  const upstreamPdfUrl = belongsToTicker ? (detail?.pdfUrl ?? selectedFiling.pdfUrl) : null;
  // Prefer the Bursa disclosure URL for Download — the user's Chrome can fetch
  // it when Cloudflare 403s our server-side proxy (common on hosted deploys).
  const downloadPdfUrl = upstreamPdfUrl;
  const proxyDownloadUrl =
    belongsToTicker && upstreamPdfUrl ? filingPdfPath(activeTicker, selectedFilingId, true) : null;
  const previewPdfUrl =
    belongsToTicker && upstreamPdfUrl ? filingPdfPath(activeTicker, selectedFilingId) : null;
  const title = detail?.title ?? selectedFiling.title;
  const company =
    detail?.company ??
    selectedFiling.companyName ??
    selectedFiling.company ??
    activeCompany;

  return (
    <div className="fixed inset-0 z-50" data-drawer-open="">
      <button type="button" aria-label="Close filing" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex h-full max-h-dvh w-[min(640px,100vw)] flex-col overflow-hidden border-l border-line bg-panel shadow-2xl max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[85vh] max-sm:max-h-[85vh] max-sm:w-full max-sm:rounded-t-lg max-sm:border-l-0 max-sm:border-t"
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Official filing
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[11px] text-neutral-500 hover:text-gain"
          >
            CLOSE
          </button>
        </div>

        <div className="shrink-0 border-b border-line px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <FilingBadge item={detail ?? selectedFiling} />
            <span className="font-mono text-[10px] text-neutral-500">
              {formatKlStamp(selectedFiling.publishedAt)}
            </span>
            <Link
              href={terminalHref(activeTicker)}
              className="font-mono text-[10px] text-gain hover:underline"
            >
              {activeTicker}
            </Link>
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-snug text-neutral-100">{title}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{company}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={selectedFiling.bursaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-gain hover:underline"
            >
              Open on Bursa ↗
            </a>
            <a
              href={selectedFiling.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 hover:text-gain"
            >
              Filing page ↗
            </a>
            {downloadPdfUrl ? (
              <a
                href={downloadPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 hover:text-gain"
              >
                Download PDF ↗
              </a>
            ) : null}
            {proxyDownloadUrl ? (
              <a
                href={proxyDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-gain"
              >
                Proxy download ↗
              </a>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[#0a0a0a]">
          {loading ? (
            <p className="px-3 py-4 font-mono text-[10px] uppercase tracking-wider text-neutral-600">
              Loading filing…
            </p>
          ) : previewPdfUrl && upstreamPdfUrl ? (
            <FilingPdfViewer
              pdfUrl={previewPdfUrl}
              upstreamPdfUrl={upstreamPdfUrl}
              title={detail?.pdfName ?? "Filing Preview"}
              downloadHref={downloadPdfUrl ?? upstreamPdfUrl}
            />
          ) : (
            <div className="custom-scrollbar h-full overflow-y-auto px-3 py-3">
              {error ? <p className="font-mono text-[10px] text-neutral-500">{error}</p> : null}
              {detail?.excerpt ? (
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-300">
                  {detail.excerpt}
                </p>
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    No PDF attached for this filing
                  </p>
                  <p className="max-w-sm text-[12px] leading-snug text-neutral-400">
                    Bursa has not published a downloadable document for this announcement. Open the
                    company announcements page for the official text.
                  </p>
                  <a
                    href={selectedFiling.bursaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:underline"
                  >
                    Open Bursa announcements ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
