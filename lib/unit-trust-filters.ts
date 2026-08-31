import type {
  UnitTrustCategoryFilter,
  UnitTrustFund,
  UnitTrustProvider,
} from "@/lib/unit-trust/types";

export type UnitTrustProviderFilter = UnitTrustProvider | "All Companies";

export type UnitTrustFilterState = {
  provider: UnitTrustProviderFilter;
  category: UnitTrustCategoryFilter;
  query: string;
};

export const DEFAULT_UNIT_TRUST_FILTERS: UnitTrustFilterState = {
  provider: "All Companies",
  category: "All Categories",
  query: "",
};

function matchesCategory(fund: UnitTrustFund, category: UnitTrustCategoryFilter): boolean {
  if (category === "All Categories") return true;
  if (category === "Fixed Price") return fund.priceType === "Fixed";
  if (category === "Variable Price") return fund.priceType === "Variable";
  return fund.category === category;
}

export function filterUnitTrusts(
  funds: UnitTrustFund[],
  filters: UnitTrustFilterState,
): UnitTrustFund[] {
  const needle = filters.query.trim().toLowerCase();

  return funds.filter((fund) => {
    if (filters.provider !== "All Companies" && fund.provider !== filters.provider) return false;
    if (!matchesCategory(fund, filters.category)) return false;
    if (!needle) return true;

    const haystack = [
      fund.name,
      fund.shortName,
      fund.provider,
      fund.fundCode,
      fund.category,
      fund.priceType,
      fund.id,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

export function defaultUnitTrustSelection(funds: UnitTrustFund[]): UnitTrustFund | null {
  return funds.find((f) => f.id === "asb") ?? funds[0] ?? null;
}
