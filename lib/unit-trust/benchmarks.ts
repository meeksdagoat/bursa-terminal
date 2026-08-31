import type { UnitTrustFund } from "@/lib/unit-trust/types";

export function computeUnitTrustBenchmarks(funds: UnitTrustFund[]) {
  const asbFixed = funds.filter(
    (f) => f.priceType === "Fixed" && (f.fundCode.startsWith("ASB") || f.fundCode.startsWith("ASM")),
  );
  const asbYields = asbFixed
    .map((f) => f.dividendYieldPct)
    .filter((v): v is number => v != null);
  const avgAsbDistribution =
    asbYields.length > 0 ? asbYields.reduce((sum, v) => sum + v, 0) / asbYields.length : null;

  const variableFunds = funds.filter((f) => f.priceType === "Variable" && f.return1yPct != null);
  const topVariable = [...variableFunds].sort((a, b) => (b.return1yPct ?? 0) - (a.return1yPct ?? 0))[0] ?? null;

  return {
    avgAsbDistributionPct: avgAsbDistribution,
    topVariableFund: topVariable,
    totalTracked: funds.length,
  };
}
