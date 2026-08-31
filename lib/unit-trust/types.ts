/** Shared unit trust tracker types (API + UI). */

export type UnitTrustProvider =
  | "ASNB"
  | "Public Mutual"
  | "AHAM Capital"
  | "Principal"
  | "Eastspring"
  | "Kenanga";

export type UnitTrustPriceType = "Fixed" | "Variable";

export type UnitTrustCategory =
  | "Equity"
  | "Balanced"
  | "Sukuk"
  | "Mixed Asset"
  | "Fixed Income";

export type UnitTrustHistoryPoint = {
  year: number;
  nav: number;
  /** Distribution in sen per unit (annual). */
  distributionSen: number | null;
  distributionYieldPct: number | null;
  /** Total return for the calendar year (%), when available. */
  returnPct: number | null;
};

export type UnitTrustFund = {
  id: string;
  fundCode: string;
  name: string;
  shortName: string;
  provider: UnitTrustProvider;
  manager: UnitTrustProvider;
  priceType: UnitTrustPriceType;
  category: UnitTrustCategory;
  shariah: boolean;
  shariahStatus: "SHARIAH" | "CONVENTIONAL";
  currentNav: number;
  ytdReturn: number | null;
  return1yPct: number | null;
  return3yPct: number | null;
  dividendYieldPct: number | null;
  distributionSen: number | null;
  latestDividendSen: number | null;
  history: UnitTrustHistoryPoint[];
};

export type UnitTrustApiPayload = {
  asOf: string;
  priceDate: string | null;
  source: "fimm" | "stale";
  funds: UnitTrustFund[];
};

export const UNIT_TRUST_PROVIDERS: readonly UnitTrustProvider[] = [
  "ASNB",
  "Public Mutual",
  "AHAM Capital",
  "Principal",
  "Eastspring",
  "Kenanga",
] as const;

export const UNIT_TRUST_CATEGORY_FILTERS = [
  "All Categories",
  "Fixed Price",
  "Variable Price",
  "Equity",
  "Balanced",
  "Sukuk",
  "Mixed Asset",
] as const;

export type UnitTrustCategoryFilter = (typeof UNIT_TRUST_CATEGORY_FILTERS)[number];
