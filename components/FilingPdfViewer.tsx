"use client";

import { useEffect, useState } from "react";
import { googleDocsPdfViewerUrl } from "@/lib/filing-id";

type PreviewMode = "proxy" | "google";

type FilingPdfViewerProps = {
  /** Same-origin proxy URL (`/api/filings/pdf` or `/api/filings/proxy-pdf`). */
  pdfUrl: string;
  /** Upstream Bursa disclosure URL — opens in the user's browser when the proxy is blocked. */
  upstreamPdfUrl?: string | null;
  title: string;
  downloadHref: string;
};

/**
 * Same-origin PDF iframe. Bursa/Cloudflare often 403s datacenter proxies while
 * the user's own Chrome can open the disclosure URL — so we always surface a
 * direct upstream escape hatch when the proxy fails.
 */
export function FilingPdfViewer({
  pdfUrl,
  upstreamPdfUrl,
  title,
  downloadHref,
}: FilingPdfViewerProps) {
  const [mode, setMode] = useState<PreviewMode>("proxy");
  const [proxyFailed, setProxyFailed] = useState(false);
  const googleUrl = upstreamPdfUrl ? googleDocsPdfViewerUrl(upstreamPdfUrl) : null;
  const src = mode === "google" && googleUrl ? googleUrl : pdfUrl;
  const openHref = upstreamPdfUrl ?? downloadHref;

  useEffect(() => {
    let cancelled = false;
    setMode("proxy");
    setProxyFailed(false);

    async function probe() {
      try {
        const response = await fetch(pdfUrl, {
          method: "GET",
          headers: { Range: "bytes=0-7" },
          cache: "no-store",
        });
        if (cancelled) return;
        const type = (response.headers.get("content-type") ?? "").toLowerCase();
        const ok =
          response.ok && (type.includes("pdf") || type.includes("octet-stream") || type.includes("octet"));
        if (!ok) {
          // Range may be ignored and still return JSON error bodies.
          const peek = type.includes("json") || type.includes("text") ? await response.clone().text() : "";
          if (!response.ok || /upstream pdf|error fetching|not allowed/i.test(peek)) {
            setProxyFailed(true);
          }
        }
      } catch {
        if (!cancelled) setProxyFailed(true);
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  if (proxyFailed && mode === "proxy") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
          <div className="flex items-center gap-1">
            <PreviewTab label="Proxy preview" active onSelect={() => undefined} />
            {googleUrl ? (
              <PreviewTab label="Google viewer" active={false} onSelect={() => setMode("google")} />
            ) : null}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">
            Proxy blocked by Bursa
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            In-app preview unavailable
          </p>
          <p className="max-w-sm text-[12px] leading-snug text-neutral-400">
            Bursa is blocking the server proxy (HTTP 403). Open the PDF in your browser instead —
            that uses your PC&apos;s connection, which usually works.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:underline"
            >
              Open PDF in browser ↗
            </a>
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 hover:text-gain"
            >
              Retry proxy download ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

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

      <iframe
        key={src}
        title={title}
        src={src}
        className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
        onError={() => {
          if (mode === "proxy") setProxyFailed(true);
        }}
      />

      <p className="sr-only">If the preview stays blank, open the PDF directly: {openHref}</p>
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
