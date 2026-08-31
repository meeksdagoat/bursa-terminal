/** Sustainable Malaysian M-REIT distribution yields rarely exceed ~12%. */
const MAX_REIT_DISTRIBUTION_YIELD_PCT = 15;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Annual distribution yield from Yahoo fields.
 * Prefers `dividendYield` (already %) over trailing ratio, which can spike when
 * price tape is stale — e.g. Tower REIT (5111) showing +41% via trailing yield.
 */
export function distributionYieldPctFromYahoo(row: Record<string, unknown>): number | null {
  const plainYield = num(row.dividendYield);
  const trailingYield = num(row.trailingAnnualDividendYield);
  const divRate = num(row.trailingAnnualDividendRate) ?? num(row.dividendRate);
  const price = num(row.regularMarketPrice);

  if (plainYield != null) {
    const pct = plainYield > 1 ? plainYield : plainYield * 100;
    if (pct > 0 && pct <= MAX_REIT_DISTRIBUTION_YIELD_PCT) {
      return Math.round(pct * 100) / 100;
    }
  }

  if (divRate != null && price != null && price > 0) {
    const pct = (divRate / price) * 100;
    if (pct > 0 && pct <= MAX_REIT_DISTRIBUTION_YIELD_PCT) {
      return Math.round(pct * 100) / 100;
    }
  }

  if (trailingYield != null) {
    const pct = Math.abs(trailingYield) <= 1.5 ? trailingYield * 100 : trailingYield;
    if (pct > 0 && pct <= MAX_REIT_DISTRIBUTION_YIELD_PCT) {
      return Math.round(pct * 100) / 100;
    }
  }

  return null;
}

/** Guard display/sort values that slip through with bad upstream tape. */
export function sanitizeReitDistributionYield(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_REIT_DISTRIBUTION_YIELD_PCT) return null;
  return Math.round(value * 100) / 100;
}

/** Same cap logic for generic dividend yield fields (screener, quotes). */
export function sanitizeDividendYieldPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 20) return null;
  return Math.round(value * 100) / 100;
}
