import "server-only";

import type {
  AnnualResult,
  FundamentalsPayload,
  FundamentalsProfitLine,
  QuarterlyResult,
  UniverseEntry,
} from "./types";
import { fetchFundamentalsTimeSeries, fetchQuotes } from "./yahoo";

/**
 * Live Yahoo Finance income / cash-flow / balance-sheet history for a Bursa name.
 * Only periods with reported actuals are returned — no stub series, no forward fill.
 */

const HISTORY_START = "2014-01-01";
const MAX_ANNUAL = 10;
const MAX_QUARTERS = 8;
const FINANCIAL_SECTORS = new Set(["Banking", "Financials", "Insurance"]);

type AnnualAcc = {
  year: number;
  revenue: number | null;
  grossProfit: number | null;
  netInterestIncome: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  debtToEquity: number | null;
};

type QuarterAcc = {
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  revenue: number | null;
  netProfit: number | null;
  eps: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pick(row: Record<string, unknown>, names: string[]): number | null {
  for (const name of names) {
    const direct = num(row[name]);
    if (direct != null) return direct;
    for (const prefix of ["annual", "quarterly", "trailing"] as const) {
      const prefixed = `${prefix}${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
      const value = num(row[prefixed]);
      if (value != null) return value;
    }
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e11 ? value : value * 1000;
    return new Date(ms);
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  return null;
}

const klYearMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
});

function fiscalParts(date: Date): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const [yearStr, monthStr] = klYearMonth.format(date).split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
  return { year, quarter };
}

function yoy(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 10_000) / 100;
}

function isTrailing(row: Record<string, unknown>): boolean {
  const period = String(row.periodType ?? "").toUpperCase();
  return period === "TTM" || period === "TRAILING";
}

function statementRows(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = asRecord(item);
    return row && !isTrailing(row) ? [row] : [];
  });
}

function revenueOf(row: Record<string, unknown>): number | null {
  return pick(row, ["totalRevenue", "operatingRevenue"]);
}

function netIncomeOf(row: Record<string, unknown>): number | null {
  return pick(row, [
    "netIncome",
    "netIncomeCommonStockholders",
    "netIncomeFromContinuingOperationNetMinorityInterest",
  ]);
}

function epsOf(row: Record<string, unknown>, netIncome: number | null): number | null {
  const reported = pick(row, ["dilutedEPS", "basicEPS"]);
  if (reported != null) return reported;
  const shares = pick(row, ["dilutedAverageShares", "basicAverageShares"]);
  if (netIncome == null || shares == null || shares === 0) return null;
  return netIncome / shares;
}

function hasPnl(row: { revenue: number | null; netIncome?: number | null; netProfit?: number | null }): boolean {
  return row.revenue != null || row.netIncome != null || row.netProfit != null;
}

async function loadSeries(
  symbol: string,
  type: "annual" | "quarterly",
  module: "financials" | "cash-flow" | "balance-sheet",
  period2?: Date,
): Promise<unknown[]> {
  try {
    return await fetchFundamentalsTimeSeries(symbol, {
      period1: HISTORY_START,
      ...(period2 ? { period2 } : {}),
      type,
      module,
    });
  } catch {
    return [];
  }
}

function mergeStatement(
  into: Record<string, unknown> | undefined,
  from: Record<string, unknown>,
): Record<string, unknown> {
  if (!into) return { ...from };
  const out = { ...into };
  for (const [key, value] of Object.entries(from)) {
    if (value != null && out[key] == null) out[key] = value;
  }
  return out;
}

function statementDateKey(row: Record<string, unknown>): string | null {
  const date = toDate(row.date);
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Yahoo's latest window often drops older quarters; overlap a 1y-earlier window to recover them. */
async function loadQuarterlyFinancials(symbol: string): Promise<Record<string, unknown>[]> {
  const yearAgo = new Date();
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);

  const [latest, prior] = await Promise.all([
    loadSeries(symbol, "quarterly", "financials"),
    loadSeries(symbol, "quarterly", "financials", yearAgo),
  ]);

  const byDate = new Map<string, Record<string, unknown>>();
  for (const row of [...statementRows(latest), ...statementRows(prior)]) {
    const key = statementDateKey(row);
    if (!key) continue;
    byDate.set(key, mergeStatement(byDate.get(key), row));
  }

  let oldest: Date | null = null;
  for (const key of byDate.keys()) {
    const date = new Date(`${key}T00:00:00.000Z`);
    if (!oldest || date < oldest) oldest = date;
  }

  if (oldest) {
    const older = statementRows(
      await loadSeries(symbol, "quarterly", "financials", new Date(oldest.getTime() - 86_400_000)),
    );
    for (const row of older) {
      const key = statementDateKey(row);
      if (!key) continue;
      byDate.set(key, mergeStatement(byDate.get(key), row));
    }
  }

  return [...byDate.values()];
}

function resolveProfitLine(sector: string, annual: AnnualAcc[]): FundamentalsProfitLine {
  if (FINANCIAL_SECTORS.has(sector)) return "netInterestIncome";
  const hasGross = annual.some((row) => row.grossProfit != null);
  const hasNii = annual.some((row) => row.netInterestIncome != null);
  return !hasGross && hasNii ? "netInterestIncome" : "grossProfit";
}

function debtToEquityOf(row: Record<string, unknown>): number | null {
  const debt = pick(row, ["totalDebt"]);
  const equity = pick(row, [
    "stockholdersEquity",
    "commonStockEquity",
    "totalEquityGrossMinorityInterest",
  ]);
  if (debt == null || equity == null || equity === 0) return null;
  return Math.round((debt / equity) * 100) / 100;
}

export async function getCompanyFundamentals(entry: UniverseEntry): Promise<FundamentalsPayload> {
  const [annualFin, quarterlyFin, cashFlow, balanceSheet, quotes] = await Promise.all([
    loadSeries(entry.symbol, "annual", "financials"),
    loadQuarterlyFinancials(entry.symbol),
    loadSeries(entry.symbol, "annual", "cash-flow"),
    loadSeries(entry.symbol, "annual", "balance-sheet"),
    fetchQuotes([entry.symbol]).catch(() => []),
  ]);

  const byYear = new Map<number, AnnualAcc>();

  const mergeAnnual = (year: number, patch: Partial<Omit<AnnualAcc, "year">>) => {
    const current = byYear.get(year) ?? {
      year,
      revenue: null,
      grossProfit: null,
      netInterestIncome: null,
      netIncome: null,
      operatingCashFlow: null,
      debtToEquity: null,
    };
    byYear.set(year, {
      ...current,
      revenue: patch.revenue ?? current.revenue,
      grossProfit: patch.grossProfit ?? current.grossProfit,
      netInterestIncome: patch.netInterestIncome ?? current.netInterestIncome,
      netIncome: patch.netIncome ?? current.netIncome,
      operatingCashFlow: patch.operatingCashFlow ?? current.operatingCashFlow,
      debtToEquity: patch.debtToEquity ?? current.debtToEquity,
    });
  };

  for (const row of statementRows(annualFin)) {
    const date = toDate(row.date);
    if (!date) continue;
    const revenue = revenueOf(row);
    const netIncome = netIncomeOf(row);
    if (revenue == null && netIncome == null) continue;
    mergeAnnual(fiscalParts(date).year, {
      revenue,
      grossProfit: pick(row, ["grossProfit"]),
      netInterestIncome: pick(row, ["netInterestIncome"]),
      netIncome,
    });
  }

  for (const row of statementRows(cashFlow)) {
    const date = toDate(row.date);
    const ocf = pick(row, ["operatingCashFlow"]);
    if (!date || ocf == null) continue;
    const year = fiscalParts(date).year;
    if (!byYear.has(year)) continue;
    mergeAnnual(year, { operatingCashFlow: ocf });
  }

  for (const row of statementRows(balanceSheet)) {
    const date = toDate(row.date);
    const leverage = debtToEquityOf(row);
    if (!date || leverage == null) continue;
    const year = fiscalParts(date).year;
    if (!byYear.has(year)) continue;
    mergeAnnual(year, { debtToEquity: leverage });
  }

  const annualRows = [...byYear.values()].filter(hasPnl).sort((a, b) => b.year - a.year).slice(0, MAX_ANNUAL);
  const profitLine = resolveProfitLine(entry.sector, annualRows);
  const annual: AnnualResult[] = annualRows.map((row) => ({
    year: row.year,
    revenue: row.revenue,
    grossProfit: row.grossProfit,
    netInterestIncome: row.netInterestIncome,
    netIncome: row.netIncome,
    operatingCashFlow: row.operatingCashFlow,
    debtToEquity: row.debtToEquity,
  }));

  const quarters: QuarterAcc[] = [];
  const seenQuarter = new Set<string>();

  for (const row of quarterlyFin) {
    const date = toDate(row.date);
    if (!date) continue;
    const revenue = revenueOf(row);
    const netProfit = netIncomeOf(row);
    if (revenue == null && netProfit == null) continue;
    const { year, quarter } = fiscalParts(date);
    const key = `${year}-${quarter}`;
    if (seenQuarter.has(key)) continue;
    seenQuarter.add(key);
    quarters.push({
      fiscalYear: year,
      quarter,
      revenue,
      netProfit,
      eps: epsOf(row, netProfit),
    });
  }

  quarters.sort((a, b) => a.fiscalYear - b.fiscalYear || a.quarter - b.quarter);

  const priorByKey = new Map<string, QuarterAcc>();
  const quarterly: QuarterlyResult[] = [];

  for (const row of quarters) {
    const prior = priorByKey.get(`${row.fiscalYear - 1}-${row.quarter}`);
    quarterly.push({
      period: `Q${row.quarter} ${row.fiscalYear}`,
      fiscalYear: row.fiscalYear,
      quarter: row.quarter,
      revenue: row.revenue,
      netProfit: row.netProfit,
      eps: row.eps,
      revenueYoyPct: yoy(row.revenue, prior?.revenue ?? null),
      netProfitYoyPct: yoy(row.netProfit, prior?.netProfit ?? null),
      epsYoyPct: yoy(row.eps, prior?.eps ?? null),
    });
    priorByKey.set(`${row.fiscalYear}-${row.quarter}`, row);
  }

  return {
    source: "yahoo",
    symbol: entry.symbol,
    company: entry.name,
    currency: quotes[0]?.currency ?? "MYR",
    asOf: new Date().toISOString(),
    profitLine,
    quarterly: quarterly.slice(-MAX_QUARTERS).reverse(),
    annual,
  };
}
