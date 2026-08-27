import type { ScreenerCapSize, ScreenerRow } from "./types";

export const SMALL_CAP_MAX = 300_000_000;
export const MID_CAP_MAX = 2_000_000_000;

export const CAP_OPTIONS: { id: ScreenerCapSize; label: string; hint: string }[] = [
  { id: "small", label: "Small", hint: "< RM 300M" },
  { id: "mid", label: "Mid", hint: "RM 300M–2B" },
  { id: "large", label: "Large", hint: "≥ RM 2B" },
];

export const SECTOR_GROUPS: { label: string; values: string[] }[] = [
  { label: "Financial Services", values: ["Banking", "Financials", "Financial Services", "Insurance"] },
  { label: "Technology", values: ["Tech", "Technology"] },
  { label: "Plantation", values: ["Plantation"] },
  { label: "REITs", values: ["REIT", "Real Estate Investment Trusts"] },
  { label: "Energy", values: ["Energy"] },
  { label: "Utilities", values: ["Utilities"] },
  { label: "Construction", values: ["Construction"] },
  { label: "Property", values: ["Property"] },
  { label: "Consumer", values: ["Consumer", "Consumer Products & Services"] },
  { label: "Industrial", values: ["Industrial", "Industrial Products & Services"] },
  { label: "Healthcare", values: ["Health Care", "Healthcare"] },
  { label: "Telco & Media", values: ["Telco", "Telecommunications & Media", "Media"] },
  { label: "Transport", values: ["Transport", "Transportation & Logistics"] },
  { label: "Chemicals", values: ["Chemicals"] },
  { label: "Materials", values: ["Materials"] },
  { label: "Gaming", values: ["Gaming"] },
  { label: "Conglomerate", values: ["Conglomerate"] },
  { label: "Auto", values: ["Auto"] },
  { label: "Business Trust", values: ["Business Trust"] },
  { label: "Closed-End Fund", values: ["Closed-End Fund"] },
  { label: "Unclassified", values: ["Unclassified"] },
];

export type ScreenerSortKey =
  | "symbol"
  | "name"
  | "sector"
  | "pe"
  | "dividendYieldPct"
  | "marketCap"
  | "roe"
  | "shariah";

export type ScreenerFiltersState = {
  peMin: number;
  peMax: number;
  yieldMin: number;
  caps: ScreenerCapSize[];
  sector: string;
  shariahOnly: boolean;
  query: string;
};

export function capSizeOf(marketCap: number | null): ScreenerCapSize | null {
  if (marketCap == null || !Number.isFinite(marketCap)) return null;
  if (marketCap < SMALL_CAP_MAX) return "small";
  if (marketCap < MID_CAP_MAX) return "mid";
  return "large";
}

export function sectorOptions(universeSectors: string[]): { label: string; values: string[] }[] {
  const known = new Set(SECTOR_GROUPS.flatMap((group) => group.values));
  const extra = universeSectors
    .filter((sector) => !known.has(sector))
    .sort((a, b) => a.localeCompare(b))
    .map((sector) => ({ label: sector, values: [sector] }));
  return [...SECTOR_GROUPS, ...extra];
}

export function defaultScreenerFilters(shariahOnly = false, peMax = 80): ScreenerFiltersState {
  return {
    peMin: 0,
    peMax,
    yieldMin: 0,
    caps: ["small", "mid", "large"],
    sector: "",
    shariahOnly,
    query: "",
  };
}

export function applyScreenerFilters(
  rows: ScreenerRow[],
  filters: ScreenerFiltersState,
  groups: { label: string; values: string[] }[],
  peBoundMax: number,
): ScreenerRow[] {
  const needle = filters.query.trim().toLowerCase().replace(/\.kl$/, "");
  const capFilter = new Set(filters.caps);
  const capActive = capFilter.size > 0 && capFilter.size < CAP_OPTIONS.length;
  const sectorValues = filters.sector
    ? new Set(groups.find((group) => group.label === filters.sector)?.values ?? [filters.sector])
    : null;
  const peActive = filters.peMin > 0 || filters.peMax < peBoundMax - 0.01;

  return rows.filter((row) => {
    if (filters.shariahOnly && !row.shariah) return false;
    if (sectorValues && !sectorValues.has(row.sector)) return false;
    if (capActive && (row.capSize == null || !capFilter.has(row.capSize))) return false;

    if (peActive) {
      if (row.pe == null || row.pe < filters.peMin || row.pe > filters.peMax) return false;
    }

    if (filters.yieldMin > 0) {
      if (row.dividendYieldPct == null || row.dividendYieldPct < filters.yieldMin) return false;
    }

    if (!needle) return true;
    return (
      row.code.toLowerCase().includes(needle) ||
      row.symbol.toLowerCase().includes(needle) ||
      row.name.toLowerCase().includes(needle) ||
      row.shortName.toLowerCase().includes(needle)
    );
  });
}

export function sortScreenerRows(
  rows: ScreenerRow[],
  key: ScreenerSortKey,
  direction: "asc" | "desc",
): ScreenerRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const ranked = compare(left, right, key);
    if (ranked.nulls) return ranked.value;
    if (ranked.value !== 0) return ranked.value * sign;
    return left.symbol.localeCompare(right.symbol);
  });
}

function compare(
  left: ScreenerRow,
  right: ScreenerRow,
  key: ScreenerSortKey,
): { value: number; nulls: boolean } {
  if (key === "shariah") {
    return { value: Number(left.shariah) - Number(right.shariah), nulls: false };
  }
  if (key === "symbol" || key === "name" || key === "sector") {
    return { value: left[key].localeCompare(right[key], undefined, { sensitivity: "base" }), nulls: false };
  }

  const a = left[key];
  const b = right[key];
  if (a == null && b == null) return { value: 0, nulls: false };
  if (a == null) return { value: 1, nulls: true };
  if (b == null) return { value: -1, nulls: true };
  return { value: a === b ? 0 : a - b, nulls: false };
}
