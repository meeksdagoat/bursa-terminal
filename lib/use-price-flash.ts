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
    setDir(null);
    const start = window.setTimeout(() => setDir(pulse.dir), 0);
    const stop = window.setTimeout(() => setDir(null), FLASH_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [pulse?.at, pulse?.dir]);

  return flashClass(dir);
}
