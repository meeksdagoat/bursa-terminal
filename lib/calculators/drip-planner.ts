/** Constant-price dividend reinvestment schedule (illustrative planner, not a forecast). */

export type DripPlannerInput = {
  initialShares: number;
  price: number;
  yieldPct: number;
  years: number;
  annualContribution: number;
};

export type DripYearRow = {
  year: number;
  sharesStart: number;
  dividend: number;
  reinvestedShares: number;
  contributionShares: number;
  sharesEnd: number;
  portfolioValue: number;
};

export type DripPlannerResult = {
  rows: DripYearRow[];
  totalDividends: number;
  totalContributed: number;
  endingShares: number;
  endingValue: number;
};

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function projectDripSchedule(input: DripPlannerInput): DripPlannerResult {
  const price = clampNonNegative(input.price);
  const yieldPct = clampNonNegative(input.yieldPct);
  const years = Math.min(40, Math.max(1, Math.floor(input.years) || 1));
  const annualContribution = clampNonNegative(input.annualContribution);

  let shares = clampNonNegative(input.initialShares);
  const rows: DripYearRow[] = [];
  let totalDividends = 0;
  let totalContributed = 0;

  for (let year = 1; year <= years; year += 1) {
    const sharesStart = shares;
    const dividend = price > 0 ? sharesStart * price * (yieldPct / 100) : 0;
    const reinvestedShares = price > 0 ? dividend / price : 0;
    const contributionShares = price > 0 ? annualContribution / price : 0;
    shares = sharesStart + reinvestedShares + contributionShares;
    totalDividends += dividend;
    totalContributed += annualContribution;

    rows.push({
      year,
      sharesStart,
      dividend,
      reinvestedShares,
      contributionShares,
      sharesEnd: shares,
      portfolioValue: shares * price,
    });
  }

  return {
    rows,
    totalDividends,
    totalContributed,
    endingShares: shares,
    endingValue: shares * price,
  };
}
