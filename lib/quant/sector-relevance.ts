import type { QuantFactorId, QuantSeriesFactorId } from "./types";
import { QUANT_FACTOR_OPTIONS } from "./types";

export type SectorRelevanceLevel = "high" | "low";

export type SectorRelevance = {
  level: SectorRelevanceLevel;
  message: string | null;
  sector: string;
  factorLabel: string;
};

const SERIES_FACTOR_SECTORS: Partial<Record<QuantSeriesFactorId, readonly string[]>> = {
  rainfall: ["Plantation"],
  temperature: ["Plantation"],
  usd_myr: ["Energy", "Chemicals", "Materials", "Consumer", "Utilities"],
  bnm_opr: ["Banking", "Financials", "Insurance", "Utilities"],
  mgs_proxy: ["Banking", "Financials", "Insurance", "Utilities"],
};

const SERIES_FACTOR_CATEGORY: Partial<Record<QuantSeriesFactorId, string>> = {
  rainfall: "Weather",
  temperature: "Weather",
  usd_myr: "FX Export Beta",
  bnm_opr: "Macro Rates",
  mgs_proxy: "Yield Sensitivity",
};

const OVERVIEW_FACTOR_SECTORS: Partial<Record<QuantFactorId, readonly string[]>> = {
  "weather-agri": ["Plantation"],
  "fx-beta": ["Energy", "Chemicals", "Materials", "Consumer", "Utilities"],
  "yield-spread": ["Banking", "Financials", "Insurance", "Utilities"],
};

const OVERVIEW_FACTOR_CATEGORY: Partial<Record<QuantFactorId, string>> = {
  "weather-agri": "Weather",
  "news-velocity": "News Velocity",
  "fx-beta": "FX Export Beta",
  "yield-spread": "Yield Sensitivity",
  "sector-breadth": "Market Breadth",
};

/** Sector/category labels shown instead of individual ticker names in factor UI. */
export const FACTOR_TARGET_CATEGORIES: Record<QuantFactorId, readonly string[]> = {
  "weather-agri": ["Plantation"],
  "news-velocity": ["Large Cap", "Multi-sector"],
  "fx-beta": ["Export / FX Sensitive", "Energy", "Healthcare"],
  "yield-spread": ["Banking", "Fixed Income"],
  "sector-breadth": ["All Sectors"],
};

export function formatFactorTargetCategories(factorId: QuantFactorId): string {
  return FACTOR_TARGET_CATEGORIES[factorId].join(", ");
}

function buildLowRelevanceMessage(sector: string, factorLabel: string): string {
  return `Low Sector Relevance (${sector} vs. ${factorLabel})`;
}

function assessRelevance(
  sector: string,
  relevantSectors: readonly string[] | undefined,
  factorLabel: string,
): SectorRelevance {
  if (!relevantSectors || relevantSectors.length === 0 || relevantSectors.includes(sector)) {
    return { level: "high", message: null, sector, factorLabel };
  }

  return {
    level: "low",
    message: buildLowRelevanceMessage(sector, factorLabel),
    sector,
    factorLabel,
  };
}

/** Correlation-engine factor ↔ target symbol sector match. */
export function assessSeriesFactorRelevance(
  factorId: QuantSeriesFactorId,
  sector: string,
): SectorRelevance {
  const factorLabel =
    SERIES_FACTOR_CATEGORY[factorId] ??
    QUANT_FACTOR_OPTIONS.find((option) => option.id === factorId)?.label ??
    factorId;

  return assessRelevance(sector, SERIES_FACTOR_SECTORS[factorId], factorLabel);
}

/** Factor score overview card ↔ target symbol sector match. */
export function assessOverviewFactorRelevance(
  factorId: QuantFactorId,
  sector: string,
): SectorRelevance {
  const factorLabel = OVERVIEW_FACTOR_CATEGORY[factorId] ?? factorId;
  return assessRelevance(sector, OVERVIEW_FACTOR_SECTORS[factorId], factorLabel);
}
