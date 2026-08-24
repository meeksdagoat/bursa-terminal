"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type TapHintProps = {
  text: string;
  title?: string;
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
};

/**
 * Tap-to-toggle popover that replaces hover-only `title` tooltips on touch.
 * Hover still reveals the card on fine pointers.
 */
export function TapHint({ text, title, align = "left", children, className = "" }: TapHintProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function toggle() {
    setOpen((value) => !value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <span ref={rootRef} className={`group relative inline-flex ${className}`}>
      <span
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="inline-flex min-h-11 cursor-help items-center text-left md:min-h-0"
      >
        {children}
      </span>
      {open ? (
        <span
          role="tooltip"
          className={`absolute top-full z-[90] mt-1 w-[236px] border border-line bg-[#050505] p-2 text-left shadow-[0_8px_24px_rgba(0,0,0,0.8)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {title ? (
            <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-amber-400">
              {title}
            </span>
          ) : null}
          <span className={`block text-[11px] leading-snug text-neutral-200 ${title ? "mt-1" : ""}`}>
            {text}
          </span>
        </span>
      ) : (
        <span
          role="tooltip"
          className={`pointer-events-none absolute top-full z-[90] mt-1 hidden w-[236px] border border-line bg-[#050505] p-2 text-left shadow-[0_8px_24px_rgba(0,0,0,0.8)] group-hover:block ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {title ? (
            <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-amber-400">
              {title}
            </span>
          ) : null}
          <span className={`block text-[11px] leading-snug text-neutral-200 ${title ? "mt-1" : ""}`}>
            {text}
          </span>
        </span>
      )}
    </span>
  );
}
