"use client";

import { useEffect } from "react";

/**
 * Locks background scrolling while a modal or drawer is open. Uses
 * `overscroll-behavior: contain` so iOS Safari / Android Chrome do not bounce
 * the page underneath, and pins `body` only when the document itself scrolls.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const pageScrolls = documentElement.scrollHeight > window.innerHeight + 1;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: documentElement.style.overflow,
      htmlOverscroll: documentElement.style.overscrollBehavior,
    };

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "contain";

    if (pageScrolls) {
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
    }

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      documentElement.style.overflow = previous.htmlOverflow;
      documentElement.style.overscrollBehavior = previous.htmlOverscroll;
      if (pageScrolls) window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
