"use client";

import { useEffect, useRef, useState } from "react";
import type { SymbolFactorsPayload } from "@/lib/quant/types";
import type { QuantFactorSignal } from "@/lib/quant/types";

const REFRESH_MS = 5 * 60 * 1000;

export function useSymbolFactorScores(
  symbol: string,
  fallbackFactors: QuantFactorSignal[],
  hubLoading: boolean,
) {
  const [payload, setPayload] = useState<SymbolFactorsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbolRef = useRef(symbol);

  useEffect(() => {
    symbolRef.current = symbol;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/quant-hub/factors?symbol=${encodeURIComponent(symbol)}`,
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : `Request failed (${response.status})`;
          throw new Error(message);
        }
        if (cancelled || symbolRef.current !== symbol) return;
        setPayload(body as SymbolFactorsPayload);
        setError(null);
      } catch (cause) {
        if (cancelled || symbolRef.current !== symbol) return;
        setError(cause instanceof Error ? cause.message : "Factor request failed");
      } finally {
        if (!cancelled && symbolRef.current === symbol) setLoading(false);
      }
    }

    void load();
    timer = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [symbol]);

  const factors =
    payload?.symbol === symbol && payload.factors.length > 0
      ? payload.factors
      : fallbackFactors;

  const initialLoading = hubLoading && fallbackFactors.length === 0;
  const recalculating = loading && !initialLoading;

  return {
    factors,
    targetSector: payload?.symbol === symbol ? payload.targetSector : null,
    symbolLabel: payload?.symbol === symbol ? payload.symbolLabel : null,
    loading: initialLoading || (loading && factors.length === 0),
    recalculating,
    error,
  };
}
