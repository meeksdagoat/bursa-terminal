/** Custom backtest strategy types and evaluation — client-safe. */

import {
  DEFAULT_CUSTOM_STRATEGY_TIMEFRAME,
  coerceHistoricalBacktestTimeframe,
  isBacktestTimeframe,
  type BacktestTimeframe,
} from "./backtest-timeframe";

export type ConditionOperator = ">" | "<" | "CROSSES_ABOVE" | "CROSSES_BELOW";

export type ConditionIndicator = "PRICE" | "SMA" | "EMA" | "RSI" | "VOLUME";

export type Condition = {
  indicatorA: ConditionIndicator;
  periodA: number;
  operator: ConditionOperator;
  indicatorB: "PRICE" | "SMA" | "EMA" | "RSI" | "VALUE";
  periodB: number;
  valueB: number;
};

export type StrategyExecutionType = "STANDARD" | "SPOT_ACCUMULATION";

export type { BacktestTimeframe };

export type CustomStrategy = {
  id: string;
  name: string;
  /** Optional short description shown in the strategy selector hint. */
  description?: string;
  /** Category tag for grouping (e.g. ORB, Mean Reversion). */
  category?: string;
  buyConditions: Condition[];
  sellConditions: Condition[];
  stopLossPct?: number;
  takeProfitPct?: number;
  /** Trailing stop distance (% from peak) — stored for future engine support. */
  trailingStopPct?: number;
  /** Preferred bar interval for backtesting this strategy (e.g. 15m, 1D). */
  defaultTimeframe?: BacktestTimeframe;
  executionType?: StrategyExecutionType;
  /** Percentage of remaining cash deployed on each accumulation buy (default 25). */
  spotBuyPctOfCash?: number;
  /** ISO timestamp — updated on each save for edit-session freshness. */
  updatedAt?: string;
};

export const CUSTOM_STRATEGIES_STORAGE_KEY = "custom_quant_strategies";

const LEGACY_CUSTOM_STRATEGIES_STORAGE_KEY = "bursa_custom_strategies";

export const STRATEGY_CATEGORIES = [
  "Mean Reversion",
  "Momentum",
  "Breakout",
  "ORB",
  "Trend Following",
  "Custom",
] as const;

export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number];

const MIN_INDICATOR_PERIOD = 1;
const MAX_INDICATOR_PERIOD = 200;

export function isValidIndicatorPeriod(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_INDICATOR_PERIOD && value <= MAX_INDICATOR_PERIOD;
}

export function validateConditionPeriods(conditions: Condition[]): string | null {
  for (const condition of conditions) {
    if (
      condition.indicatorA !== "PRICE" &&
      !isValidIndicatorPeriod(condition.periodA)
    ) {
      return `${condition.indicatorA} period must be an integer between ${MIN_INDICATOR_PERIOD} and ${MAX_INDICATOR_PERIOD}.`;
    }
    if (
      condition.indicatorB !== "VALUE" &&
      condition.indicatorB !== "PRICE" &&
      !isValidIndicatorPeriod(condition.periodB)
    ) {
      return `${condition.indicatorB} period must be an integer between ${MIN_INDICATOR_PERIOD} and ${MAX_INDICATOR_PERIOD}.`;
    }
  }
  return null;
}

export const CONDITION_INDICATORS: readonly ConditionIndicator[] = [
  "PRICE",
  "SMA",
  "EMA",
  "RSI",
  "VOLUME",
];

export const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  ">",
  "<",
  "CROSSES_ABOVE",
  "CROSSES_BELOW",
];

export const CONDITION_INDICATORS_B: readonly Condition["indicatorB"][] = [
  "PRICE",
  "SMA",
  "EMA",
  "RSI",
  "VALUE",
];

export function createEmptyCondition(side: "buy" | "sell"): Condition {
  if (side === "buy") {
    return {
      indicatorA: "RSI",
      periodA: 14,
      operator: "<",
      indicatorB: "VALUE",
      periodB: 14,
      valueB: 30,
    };
  }

  return {
    indicatorA: "RSI",
    periodA: 14,
    operator: ">",
    indicatorB: "VALUE",
    periodB: 14,
    valueB: 70,
  };
}

export function createCustomStrategyDraft(name = ""): CustomStrategy {
  return {
    id: crypto.randomUUID(),
    name,
    buyConditions: [createEmptyCondition("buy")],
    sellConditions: [createEmptyCondition("sell")],
    stopLossPct: 8,
    takeProfitPct: 15,
    defaultTimeframe: DEFAULT_CUSTOM_STRATEGY_TIMEFRAME,
    executionType: "STANDARD",
    spotBuyPctOfCash: 25,
    updatedAt: new Date().toISOString(),
  };
}

export function ensureStrategyId(strategy: CustomStrategy): CustomStrategy {
  const id = strategy.id?.trim();
  return {
    ...strategy,
    id: id && id.length > 0 ? id : crypto.randomUUID(),
  };
}

export function cloneCustomStrategy(strategy: CustomStrategy): CustomStrategy {
  return structuredClone(strategy);
}

export function dedupeCustomStrategies(strategies: CustomStrategy[]): CustomStrategy[] {
  const byId = new Map<string, CustomStrategy>();
  for (const row of strategies) {
    const normalized = ensureStrategyId(row);
    byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values());
}

export function resolveCustomStrategyById(
  strategies: CustomStrategy[],
  id: string | null | undefined,
): CustomStrategy | null {
  if (!id) return null;
  return strategies.find((row) => row.id === id) ?? null;
}

export function isBuiltinStrategyKey(value: string): boolean {
  return !value.startsWith("custom:");
}

export function isSpotAccumulationStrategy(
  strategy: CustomStrategy | null | undefined,
): boolean {
  return strategy?.executionType === "SPOT_ACCUMULATION";
}

export function resolveCustomStrategyTimeframe(
  strategy: CustomStrategy | null | undefined,
): BacktestTimeframe {
  const value = strategy?.defaultTimeframe;
  if (value && isBacktestTimeframe(value)) {
    return coerceHistoricalBacktestTimeframe(value);
  }
  return DEFAULT_CUSTOM_STRATEGY_TIMEFRAME;
}

export function customStrategyKey(id: string): string {
  return `custom:${id}`;
}

export function isCustomStrategyKey(value: string): boolean {
  return value.startsWith("custom:");
}

export function customStrategyIdFromKey(value: string): string | null {
  return isCustomStrategyKey(value) ? value.slice("custom:".length) : null;
}

export function loadCustomStrategies(): CustomStrategy[] {
  if (typeof window === "undefined") return [];

  try {
    let raw = window.localStorage.getItem(CUSTOM_STRATEGIES_STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_CUSTOM_STRATEGIES_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const migrated = dedupeCustomStrategies(
        parsed.filter(isValidCustomStrategy).map(normalizeStoredStrategy),
      );
      saveCustomStrategies(migrated);
      window.localStorage.removeItem(LEGACY_CUSTOM_STRATEGIES_STORAGE_KEY);
      return migrated;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeCustomStrategies(
      parsed.filter(isValidCustomStrategy).map(normalizeStoredStrategy),
    );
  } catch {
    return [];
  }
}

function normalizeStoredStrategy(strategy: CustomStrategy & Record<string, unknown>): CustomStrategy {
  const withId = ensureStrategyId(strategy);
  return {
    id: withId.id,
    name: withId.name,
    description: withId.description,
    category: withId.category,
    buyConditions: withId.buyConditions,
    sellConditions: withId.sellConditions,
    stopLossPct: withId.stopLossPct,
    takeProfitPct: withId.takeProfitPct,
    trailingStopPct: withId.trailingStopPct,
    defaultTimeframe: withId.defaultTimeframe,
    executionType: withId.executionType ?? "STANDARD",
    spotBuyPctOfCash: withId.spotBuyPctOfCash,
    updatedAt: withId.updatedAt,
  };
}

export function saveCustomStrategies(strategies: CustomStrategy[]): void {
  if (typeof window === "undefined") return;
  saveCustomStrategiesToStorage(dedupeCustomStrategies(strategies));
}

function saveCustomStrategiesToStorage(strategies: CustomStrategy[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_STRATEGIES_STORAGE_KEY, JSON.stringify(strategies));
}

function isValidCustomStrategy(value: unknown): value is CustomStrategy {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<CustomStrategy>;
  const isSpot = row.executionType === "SPOT_ACCUMULATION";
  const hasBuyRules = Array.isArray(row.buyConditions) && row.buyConditions.length > 0;
  const hasStandardVisualRules =
    hasBuyRules &&
    Array.isArray(row.sellConditions) &&
    row.sellConditions.length > 0;
  const hasSpotVisualRules = hasBuyRules;

  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    (isSpot ? hasSpotVisualRules : hasStandardVisualRules)
  );
}

export function formatConditionLabel(condition: Condition): string {
  const left = `${condition.indicatorA}${condition.periodA > 1 ? `(${condition.periodA})` : ""}`;
  const right =
    condition.indicatorB === "VALUE"
      ? String(condition.valueB)
      : `${condition.indicatorB}${condition.periodB > 1 ? `(${condition.periodB})` : ""}`;
  return `${left} ${condition.operator} ${right}`;
}
