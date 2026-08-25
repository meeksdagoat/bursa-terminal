"use client";

import { useEffect, useRef, useState } from "react";

export type FlashState = "up" | "down" | null;

const FLASH_MS = 600;

export function flashCardClass(flash: FlashState): string {
  if (flash === "up") {
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
  }
  if (flash === "down") {
    return "bg-rose-500/20 text-rose-400 border-rose-500/50";
  }
  return "bg-[#0a0a0a] border-transparent";
}

export function flashPriceClass(flash: FlashState): string {
  if (flash === "up") return "text-emerald-400";
  if (flash === "down") return "text-rose-400";
  return "text-neutral-100";
}

/**
 * Compares each incoming price to the previous tick and holds an up/down flash
 * for 600ms. Timeouts are cleared on the next tick and on unmount.
 */
export function useTickFlash(price: number | null | undefined): FlashState {
  const previousRef = useRef<number | null>(null);
  const [flashState, setFlashState] = useState<FlashState>(null);

  useEffect(() => {
    const previousPrice = previousRef.current;
    const newPrice = price ?? null;

    if (newPrice != null) {
      previousRef.current = newPrice;
    }

    if (previousPrice == null || newPrice == null || newPrice === previousPrice) {
      return;
    }

    setFlashState(newPrice > previousPrice ? "up" : "down");
    const timer = window.setTimeout(() => setFlashState(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [price]);

  return flashState;
}
