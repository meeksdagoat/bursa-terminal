"use client";

import { useEffect, useState } from "react";
import type { TickPulse } from "./use-market-data";

const FLASH_MS = 850;

export function flashClass(dir: "up" | "down" | null): string {
  if (dir === "up") return "tick-up";
  if (dir === "down") return "tick-down";
  return "";
}

/** Holds a tick flash class for ~850ms after the latest pulse for `symbol`. */
export function usePriceFlash(
  symbol: string | null | undefined,
  ticks: Record<string, TickPulse>,
): string {
  const pulse = symbol ? ticks[symbol] : undefined;
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!pulse) return;
    setDir(pulse.dir);
    const timer = window.setTimeout(() => setDir(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [pulse?.at, pulse?.dir]);

  return flashClass(dir);
}
