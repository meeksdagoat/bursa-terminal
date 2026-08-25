"use client";

import { useEffect, useRef, useState } from "react";
import {
  ECONOMY_POLL_MS,
  OPEN_ER_USD_URL,
  parseOpenErRates,
  ratesHaveValues,
} from "@/lib/fx-live";
import { isBursaOpen } from "@/lib/market-status";
import { LAST_SESSION_HEATMAP, heatmapIsEmpty, heatmapRows, heatmapSymbols } from "@/lib/sectors";
import type { BnmPayload, FxRate, QuotesPayload, SectorPerformance } from "@/lib/types";

export type EconomyLive = {
  rates: FxRate[];
  fxSource: BnmPayload["source"] | null;
  fxLoading: boolean;
  fxError: string | null;
  sectors: SectorPerformance[];
  marketState: string | null;
  sessionLive: boolean;
  heatmapLoading: boolean;
};

function logEconomyError(scope: string, error: unknown) {
  const detail = error instanceof Error ? error : new Error(String(error));
  console.error(`[economy] ${scope}`, detail.message, detail);
}

async function readJson(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function fetchBnmRates(signal: AbortSignal): Promise<{ rates: FxRate[]; source: BnmPayload["source"] }> {
  const response = await fetch("/api/bnm", { signal, cache: "no-store" });
  const payload = (await readJson(response)) as BnmPayload;
  if (!ratesHaveValues(payload.rates)) {
    throw new Error(payload.errors.join("; ") || "BNM rates empty");
  }
  return { rates: payload.rates, source: payload.source };
}

async function fetchOpenErRates(
  signal: AbortSignal,
  previous: Map<string, number>,
): Promise<FxRate[]> {
  const response = await fetch(OPEN_ER_USD_URL, { signal, cache: "no-store" });
  const payload = await readJson(response);
  const rates = parseOpenErRates(payload, previous);
  if (!ratesHaveValues(rates)) throw new Error("Open ER API returned no MYR crosses");
  return rates;
}

function previousMap(rates: FxRate[]): Map<string, number> {
  return new Map(
    rates.flatMap((rate) => (rate.rate != null ? [[rate.pair, rate.rate] as const] : [])),
  );
}

function resolveSectors(live: SectorPerformance[], fallback: SectorPerformance[]): SectorPerformance[] {
  const rows = heatmapRows(live);
  if (!heatmapIsEmpty(rows)) return live;
  if (!isBursaOpen()) {
    const prior = heatmapRows(fallback);
    if (!heatmapIsEmpty(prior)) return fallback;
    return LAST_SESSION_HEATMAP;
  }
  return live.length > 0 ? live : fallback;
}

export function useEconomyLive(seedSectors: SectorPerformance[] = []): EconomyLive {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [fxSource, setFxSource] = useState<BnmPayload["source"] | null>(null);
  const [fxLoading, setFxLoading] = useState(true);
  const [fxError, setFxError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<SectorPerformance[]>(seedSectors);
  const [marketState, setMarketState] = useState<string | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [sessionLive, setSessionLive] = useState(isBursaOpen);

  const previousFx = useRef<Map<string, number>>(new Map());
  const lastSectors = useRef<SectorPerformance[]>(seedSectors);

  useEffect(() => {
    lastSectors.current = seedSectors;
  }, [seedSectors]);

  useEffect(() => {
    let cancelled = false;
    const quotesUrl = `/api/quotes?symbols=${encodeURIComponent(heatmapSymbols().join(","))}`;

    async function loadFx() {
      try {
        const bnm = await fetchBnmRates(AbortSignal.timeout(12_000));
        if (cancelled) return;
        previousFx.current = previousMap(bnm.rates);
        setRates(bnm.rates);
        setFxSource(bnm.source);
        setFxError(null);
      } catch (error) {
        logEconomyError("BNM live fetch failed — trying Open ER API", error);
        try {
          const er = await fetchOpenErRates(AbortSignal.timeout(12_000), previousFx.current);
          if (cancelled) return;
          previousFx.current = previousMap(er);
          setRates(er);
          setFxSource("open-er");
          setFxError(null);
        } catch (fallbackError) {
          logEconomyError("Open ER API fallback failed", fallbackError);
          if (!cancelled) {
            setFxError(
              fallbackError instanceof Error ? fallbackError.message : "FX request failed",
            );
          }
        }
      } finally {
        if (!cancelled) setFxLoading(false);
      }
    }

    async function loadHeatmap() {
      try {
        const response = await fetch(quotesUrl, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
        const payload = (await readJson(response)) as QuotesPayload;
        if (cancelled) return;
        const next = resolveSectors(payload.sectors ?? [], lastSectors.current);
        lastSectors.current = next;
        setSectors(next);
        setMarketState(payload.marketState ?? payload.index?.marketState ?? null);
        setSessionLive(isBursaOpen());
      } catch (error) {
        logEconomyError("sector heatmap fetch failed", error);
        if (!cancelled && lastSectors.current.length === 0) {
          lastSectors.current = LAST_SESSION_HEATMAP;
          setSectors(LAST_SESSION_HEATMAP);
          setSessionLive(false);
        }
      } finally {
        if (!cancelled) setHeatmapLoading(false);
      }
    }

    async function loadAll() {
      await Promise.all([loadFx(), loadHeatmap()]);
    }

    void loadAll();

    const timer = window.setInterval(() => {
      if (!document.hidden) void loadAll();
    }, ECONOMY_POLL_MS);

    function onVisibility() {
      if (!document.hidden) void loadAll();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return {
    rates,
    fxSource,
    fxLoading,
    fxError,
    sectors,
    marketState,
    sessionLive,
    heatmapLoading,
  };
}
