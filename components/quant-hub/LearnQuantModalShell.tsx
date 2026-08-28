"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdvancedFormulaCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type LearnQuantModalShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
  advancedSections?: AdvancedFormulaSection[];
};

export function LearnQuantModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  advancedSections = [],
}: LearnQuantModalShellProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) setAdvancedOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close guide"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="learn-quant-title"
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-800 bg-[#111111] p-0 text-neutral-200 shadow-2xl backdrop-blur-md"
      >
        <div className="overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="learn-quant-title" className="text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-neutral-400">
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-800 font-mono text-sm text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-200"
            >
              ✕
            </button>
          </div>
          {children}
        </div>

        {advancedOpen && advancedSections.length > 0 ? (
          <div className="max-h-[42vh] shrink-0 overflow-y-auto border-t border-neutral-800 bg-[#0d0d0d] px-6 py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Advanced Data &amp; Formulas
              </h3>
              <button
                type="button"
                onClick={() => setAdvancedOpen(false)}
                className="font-mono text-[10px] text-neutral-500 transition hover:text-neutral-300"
              >
                Collapse
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {advancedSections.map((section) => (
                <AdvancedFormulaCard key={section.id} section={section} />
              ))}
            </div>
          </div>
        ) : null}

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-800 px-6 py-4">
          {advancedSections.length > 0 ? (
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              aria-expanded={advancedOpen}
              className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-xs font-semibold text-neutral-300 transition hover:text-amber-400"
            >
              ⚙ Advanced Data &amp; Formulas
              <span className="text-[10px] text-neutral-500">{advancedOpen ? "▴" : "▾"}</span>
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-2 font-mono text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20"
          >
            Got it!
          </button>
        </footer>
      </div>
    </div>
  );
}
