"use client";

import { useCallback, useRef } from "react";

/**
 * Callback ref: vertical wheel/touch on a horizontal strip cannot move the
 * page. Wheel delta is applied as scrollLeft instead.
 *
 * Pass `scrollerSelector` when the ref is a locked frame and a child is the
 * actual overflow-x scroller.
 */
export function usePanXLock(scrollerSelector?: string) {
  const unbindRef = useRef<(() => void) | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      unbindRef.current?.();
      unbindRef.current = null;
      if (!node) return;

      // Capture after the null guard — nested closures don't keep the narrowing.
      const root: HTMLElement = node;

      function scroller(): HTMLElement {
        if (!scrollerSelector) return root;
        const child = root.querySelector<HTMLElement>(scrollerSelector);
        if (!child) return root;
        return getComputedStyle(child).display === "none" ? root : child;
      }

      function onWheel(event: WheelEvent) {
        event.preventDefault();
        event.stopPropagation();
        const strip = scroller();
        strip.scrollLeft += event.deltaX + event.deltaY;
      }

      function onTouchMove(event: TouchEvent) {
        event.stopPropagation();
      }

      root.addEventListener("wheel", onWheel, { passive: false, capture: true });
      root.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
      unbindRef.current = () => {
        root.removeEventListener("wheel", onWheel, true);
        root.removeEventListener("touchmove", onTouchMove, true);
      };
    },
    [scrollerSelector],
  );
}
