"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { filingProxyPdfPath, googleDocsPdfViewerUrl } from "@/lib/filing-id";

type PreviewMode = "proxy" | "google";

type FilingPdfViewerProps = {
  pdfUrl: string;
  title: string;
  downloadHref: string;
};

export function FilingPdfViewer({ pdfUrl, title, downloadHref }: FilingPdfViewerProps) {
  const [mode, setMode] = useState<PreviewMode>("proxy");
  const [proxyFailed, setProxyFailed] = useState(false);
  const proxiedPdfUrl = filingProxyPdfPath(pdfUrl);
  const googleUrl = googleDocsPdfViewerUrl(pdfUrl);
  const src = mode === "google" ? googleUrl : proxiedPdfUrl;

  useEffect(() => {
    setMode("proxy");
    setProxyFailed(false);
  }, [pdfUrl]);

  function failOverToGoogle() {
    setProxyFailed(true);
    setMode("google");
  }

  function onIframeLoad(event: SyntheticEvent<HTMLIFrameElement>) {
    if (mode !== "proxy") return;
    try {
      const doc = event.currentTarget.contentDocument;
      if (!doc) return;
      const text = doc.body?.innerText?.trim() ?? "";
      if (
        text.startsWith("{") ||
        /error fetching pdf|missing pdf url|upstream|not allowed/i.test(text)
      ) {
        failOverToGoogle();
      }
    } catch {
      // Cross-origin Google viewer — ignore.
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <PreviewTab
            label="Proxy preview"
            active={mode === "proxy"}
            onSelect={() => setMode("proxy")}
          />
          <PreviewTab
            label="Google viewer"
            active={mode === "google"}
            onSelect={() => setMode("google")}
          />
        </div>
        {proxyFailed ? (
          <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">
            Proxy failed · Google fallback
          </span>
        ) : null}
      </div>
      <iframe
        key={src}
        title={title}
        src={src}
        className="h-full w-full flex-1 border-0 bg-[#0d0d0d]"
        onLoad={onIframeLoad}
        onError={failOverToGoogle}
      />
      <p className="sr-only">
        If the preview stays blank, use Download PDF: {downloadHref}
      </p>
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
