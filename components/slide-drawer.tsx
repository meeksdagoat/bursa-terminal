"use client";

import { useEffect, type ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type SlideDrawerProps = {
  open: boolean;
  onClose: () => void;
  side: "left" | "right" | "bottom";
  title?: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Overlay drawer used for mobile/tablet side panes and the hamburger menu.
 * Body scroll is locked while open so the sheet, not the page, receives gestures.
 */
export function SlideDrawer({
  open,
  onClose,
  side,
  title,
  labelledBy,
  children,
  className = "",
  bodyClassName = "overflow-hidden",
}: SlideDrawerProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-lg border-t pb-[env(safe-area-inset-bottom)]"
      : side === "left"
        ? "inset-y-0 left-0 w-[min(340px,90vw)] border-r"
        : "inset-y-0 right-0 w-[min(340px,90vw)] border-l";

  return (
    <div className="fixed inset-0 z-[80]" data-drawer-open="">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={labelledBy}
        className={`absolute flex flex-col overflow-hidden border-line bg-panel shadow-2xl modal-overscroll ${panel} ${className}`}
      >
        {title ? (
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[11px] text-neutral-500 hover:text-gain"
            >
              CLOSE
            </button>
          </div>
        ) : null}
        <div className={`min-h-0 min-w-0 flex-1 overscroll-contain ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
