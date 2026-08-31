"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dedupeCustomStrategies,
  ensureStrategyId,
  loadCustomStrategies,
  saveCustomStrategies,
  type CustomStrategy,
} from "@/lib/quant/custom-strategy";

export type CustomStrategiesStore = {
  strategies: CustomStrategy[];
  ready: boolean;
  upsertStrategy: (strategy: CustomStrategy) => CustomStrategy;
  removeStrategy: (id: string) => void;
  getStrategyById: (id: string) => CustomStrategy | undefined;
};

export function useCustomStrategies(): CustomStrategiesStore {
  const [strategies, setStrategies] = useState<CustomStrategy[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStrategies(loadCustomStrategies());
    setReady(true);
  }, []);

  const upsertStrategy = useCallback((strategy: CustomStrategy) => {
    const normalized = ensureStrategyId({
      ...strategy,
      updatedAt: new Date().toISOString(),
    });

    setStrategies((previous) => {
      const next = dedupeCustomStrategies([
        normalized,
        ...previous.filter((row) => row.id !== normalized.id),
      ]);
      saveCustomStrategies(next);
      return next;
    });

    return normalized;
  }, []);

  const removeStrategy = useCallback((id: string) => {
    setStrategies((previous) => {
      const next = previous.filter((row) => row.id !== id);
      saveCustomStrategies(next);
      return next;
    });
  }, []);

  const strategyIndex = useMemo(() => {
    const map = new Map<string, CustomStrategy>();
    for (const strategy of strategies) {
      map.set(strategy.id, strategy);
    }
    return map;
  }, [strategies]);

  const getStrategyById = useCallback(
    (id: string) => strategyIndex.get(id),
    [strategyIndex],
  );

  return {
    strategies,
    ready,
    upsertStrategy,
    removeStrategy,
    getStrategyById,
  };
}
