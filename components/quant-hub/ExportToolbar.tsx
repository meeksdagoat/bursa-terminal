"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { downloadCsvFile, isExportTableEmpty, type ExportPayload } from "@/utils/exportData";

const BUTTON_CLASS =
  "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 text-xs px-2.5 py-1 rounded flex items-center gap-1.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-900";

type ExportToolbarProps = {
  disabled?: boolean;
  getPayload: () => ExportPayload | Promise<ExportPayload>;
};

type ToastTone = "ok" | "error";

export function ExportToolbar({ disabled = false, getPayload }: ExportToolbarProps) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const exportCsv = useCallback(async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const payload = await getPayload();
      if (isExportTableEmpty(payload.table)) {
        showToast("No data to export", "error");
        return;
      }

      downloadCsvFile(`${payload.filename}.csv`, payload.table);
      showToast("Downloaded CSV");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Export failed";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, getPayload, showToast]);

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void exportCsv()}
        className={BUTTON_CLASS}
      >
        <span aria-hidden>📥</span>
        Export CSV
      </button>

      {toast ? (
        <p
          role="status"
          className={`fixed bottom-4 right-4 z-50 whitespace-nowrap rounded border px-3 py-1.5 font-mono text-xs shadow-lg ${
            toast.tone === "ok"
              ? "border-emerald-500/30 bg-neutral-900 text-emerald-400"
              : "border-rose-500/30 bg-neutral-900 text-rose-400"
          }`}
        >
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}
