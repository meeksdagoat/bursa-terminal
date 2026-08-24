"use client";

import { useSyncExternalStore } from "react";

/**
 * Tailwind-aligned breakpoints:
 *   mobile  < 768px
 *   tablet  768px – 1023px
 *   desktop ≥ 1024px
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

export function useMediaQuery(query: string, serverSnapshot = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}

export function useBreakpoint(): Breakpoint {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const tablet = useMediaQuery("(min-width: 768px)");
  if (desktop) return "desktop";
  if (tablet) return "tablet";
  return "mobile";
}

/** True on phones/tablets where hover is unreliable and ticks should be throttled. */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
