"use client";

import { useEffect, useRef, useState } from "react";
import { JARGON, type JargonTerm } from "@/lib/jargon";

type JargonProps = {
  term: JargonTerm;
  /** Label shown in place of the term name, e.g. "Div Yld" for a tight column. */
  children?: React.ReactNode;
  /** Flip the card to the left edge for controls near the right of the screen. */
  align?: "left" | "right";
  className?: string;
};

/**
 * Dashed-underlined label that reveals a definition. Hover still works on
 * desktop; tap-to-toggle is what makes it usable on a touch screen.
 */
export function Jargon({ term, children, align = "left", className = "" }: JargonProps) {
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const entry = JARGON[term];

  useEffect(() => {
    if (!pinned) return;

    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPinned(false);
      }
    }

    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [pinned]);

  return (
    <span ref={rootRef} className="group relative inline-flex">
      <button
        type="button"
        onClick={() => setPinned((open) => !open)}
        aria-expanded={pinned}
        className={`min-h-11 cursor-help border-b border-dashed border-neutral-600 text-left decoration-dotted hover:border-amber-400/70 md:min-h-0 ${className}`}
      >
        {children ?? entry.title}
      </button>

      <span
        role="tooltip"
        className={`absolute top-full z-[90] mt-1 w-[236px] border border-line bg-[#050505] p-2 text-left shadow-[0_8px_24px_rgba(0,0,0,0.8)] transition-opacity ${
          align === "right" ? "right-0" : "left-0"
        } ${
          pinned
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      >
        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-amber-400">
          {entry.title}
        </span>
        <span className="mt-1 block text-[11px] leading-snug text-neutral-200 normal-case tracking-normal">
          {entry.body}
        </span>
      </span>
    </span>
  );
}
