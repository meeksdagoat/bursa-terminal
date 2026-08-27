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

      function scroller(): HTMLElement {
        if (!scrollerSelector) return node;
        const child = node.querySelector<HTMLElement>(scrollerSelector);
        if (!child) return node;
        return getComputedStyle(child).display === "none" ? node : child;
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

      node.addEventListener("wheel", onWheel, { passive: false, capture: true });
      node.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
      unbindRef.current = () => {
        node.removeEventListener("wheel", onWheel, true);
        node.removeEventListener("touchmove", onTouchMove, true);
      };
    },
    [scrollerSelector],
  );
}
