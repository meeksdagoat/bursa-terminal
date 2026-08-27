import "server-only";

import type {
  FinancialCell,
  FinancialPeriodColumn,
  FinancialStatementRow,
  FinancialStatementTable,
  FinancialStatementsBundle,
  FinancialStatementsPayload,
  UniverseEntry,
} from "./types";
import { fetchFundamentalsTimeSeries, fetchQuotes } from "./yahoo";

const HISTORY_START = "2014-01-01";
const MAX_ANNUAL = 10;
const MAX_QUARTERS = 8;
const FINANCIAL_SECTORS = new Set(["Banking", "Financials", "Insurance"]);

type LineSpec = {
  id: string;
  label: string;
  section: string;
  keys: string[];
  emphasize?: boolean;
  derive?: (row: Record<string, unknown>) => number | null;
};

const INCOME_LINES: LineSpec[] = [
  {
    id: "revenue",
    label: "Total revenue",
    section: "Operating",
    keys: ["totalRevenue", "operatingRevenue"],
    emphasize: true,
  },
  {
    id: "costOfRevenue",
    label: "Cost of revenue",
    section: "Operating",
    keys: ["costOfRevenue", "reconciledCostOfRevenue"],
  },
  {
    id: "grossProfit",
    label: "Gross profit",
    section: "Operating",
    keys: ["grossProfit"],
    emphasize: true,
  },
  {
    id: "netInterestIncome",
    label: "Net interest income",
    section: "Operating",
    keys: ["netInterestIncome"],
    emphasize: true,
  },
  {
    id: "operatingIncome",
    label: "Operating income",
    section: "Operating",
    keys: ["operatingIncome", "operatingIncomeLoss"],
  },
  {
    id: "ebitda",
    label: "EBITDA",
    section: "Operating",
    keys: ["ebitda", "normalizedEBITDA"],
  },
  {
    id: "pretaxIncome",
    label: "Pretax income",
    section: "Earnings",
    keys: ["pretaxIncome", "earningsBeforeTaxes"],
  },
  {
    id: "netIncome",
    label: "Net income",
    section: "Earnings",
    keys: [
      "netIncome",
      "netIncomeCommonStockholders",
      "netIncomeFromContinuingOperationNetMinorityInterest",
    ],
    emphasize: true,
  },
  {
    id: "dilutedEps",
    label: "Diluted EPS",
    section: "Earnings",
    keys: ["dilutedEPS", "basicEPS"],
  },
];

const BALANCE_LINES: LineSpec[] = [
  {
    id: "totalAssets",
    label: "Total assets",
    section: "Assets",
    keys: ["totalAssets"],
    emphasize: true,
  },
  {
    id: "currentAssets",
    label: "Current assets",
    section: "Assets",
    keys: ["currentAssets"],
  },
  {
    id: "cash",
    label: "Cash & equivalents",
    section: "Assets",
    keys: ["cashAndCashEquivalents", "cashCashEquivalentsAndShortTermInvestments", "cashFinancial"],
  },
  {
    id: "totalLiabilities",
    label: "Total liabilities",
    section: "Liabilities",
    keys: ["totalLiabilitiesNetMinorityInterest", "totalLiabilities"],
    emphasize: true,
  },
  {
    id: "currentLiabilities",
    label: "Current liabilities",
    section: "Liabilities",
    keys: ["currentLiabilities"],
  },
  {
    id: "totalDebt",
    label: "Total debt",
    section: "Liabilities",
    keys: ["totalDebt"],
    emphasize: true,
  },
  {
    id: "longTermDebt",
    label: "Long-term debt",
    section: "Liabilities",
    keys: ["longTermDebt", "longTermDebtAndCapitalLeaseObligation"],
  },
  {
    id: "equity",
    label: "Stockholders' equity",
    section: "Equity",
    keys: ["stockholdersEquity", "commonStockEquity", "totalEquityGrossMinorityInterest"],
    emphasize: true,
  },
  {
    id: "retainedEarnings",
    label: "Retained earnings",
    section: "Equity",
    keys: ["retainedEarnings"],
  },
];

const CASHFLOW_LINES: LineSpec[] = [
  {
    id: "operatingCashFlow",
    label: "Operating cash flow",
    section: "Cash flow",
    keys: ["operatingCashFlow"],
    emphasize: true,
  },
  {
    id: "capex",
    label: "Capital expenditure",
    section: "Cash flow",
    keys: ["capitalExpenditure", "purchaseOfPPE"],
  },
  {
    id: "freeCashFlow",
    label: "Free cash flow",
    section: "Cash flow",
    keys: ["freeCashFlow"],
    emphasize: true,
    derive: freeCashFlowOf,
  },
  {
    id: "investingCashFlow",
    label: "Investing cash flow",
    section: "Cash flow",
    keys: ["investingCashFlow", "cashFlowFromInvestingActivities"],
  },
  {
    id: "financingCashFlow",
    label: "Financing cash flow",
    section: "Cash flow",
    keys: ["financingCashFlow", "cashFlowFromFinancingActivities"],
  },
  {
    id: "dividendsPaid",
    label: "Dividends paid",
    section: "Cash flow",
    keys: ["cashDividendsPaid", "commonStockDividendPaid"],
  },
  {
    id: "changeInCash",
    label: "Change in cash",
    section: "Cash flow",
    keys: ["changesInCash", "changeInCashSupplementalAsReported"],
  },
];

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

function statementDateKey(row: Record<string, unknown>): string | null {
  const date = toDate(row.date);
  return date ? date.toISOString().slice(0, 10) : null;
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

async function loadSeries(
  symbol: string,
  type: "annual" | "quarterly",
  module: "financials" | "cash-flow" | "balance-sheet" | "all",
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

async function loadAllModules(
  symbol: string,
  type: "annual" | "quarterly",
  period2?: Date,
): Promise<Record<string, unknown>[]> {
  const combined = statementRows(await loadSeries(symbol, type, "all", period2));
  if (combined.length > 0) return combined;

  const [fin, cash, balance] = await Promise.all([
    loadSeries(symbol, type, "financials", period2),
    loadSeries(symbol, type, "cash-flow", period2),
    loadSeries(symbol, type, "balance-sheet", period2),
  ]);
  return [...statementRows(fin), ...statementRows(cash), ...statementRows(balance)];
}

function mergeByDate(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const byDate = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = statementDateKey(row);
    if (!key) continue;
    byDate.set(key, mergeStatement(byDate.get(key), row));
  }
  return byDate;
}

async function loadQuarterlyStatements(symbol: string): Promise<Record<string, unknown>[]> {
  const yearAgo = new Date();
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const twoYearsAgo = new Date();
  twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);

  const [latest, prior, olderWindow] = await Promise.all([
    loadAllModules(symbol, "quarterly"),
    loadAllModules(symbol, "quarterly", yearAgo),
    loadAllModules(symbol, "quarterly", twoYearsAgo),
  ]);

  const byDate = mergeByDate([...latest, ...prior, ...olderWindow]);

  let oldest: Date | null = null;
  for (const key of byDate.keys()) {
    const date = new Date(`${key}T00:00:00.000Z`);
    if (!oldest || date < oldest) oldest = date;
  }

  if (oldest) {
    const older = await loadAllModules(symbol, "quarterly", new Date(oldest.getTime() - 86_400_000));
    for (const row of older) {
      const key = statementDateKey(row);
      if (!key) continue;
      byDate.set(key, mergeStatement(byDate.get(key), row));
    }
  }

  return [...byDate.values()];
}

function freeCashFlowOf(row: Record<string, unknown>): number | null {
  const reported = pick(row, ["freeCashFlow"]);
  if (reported != null) return reported;
  const ocf = pick(row, ["operatingCashFlow"]);
  const capex = pick(row, ["capitalExpenditure", "purchaseOfPPE"]);
  if (ocf == null || capex == null) return null;
  return ocf + capex;
}

function lineValue(spec: LineSpec, row: Record<string, unknown>): number | null {
  if (spec.derive) {
    const derived = spec.derive(row);
    if (derived != null) return derived;
  }
  return pick(row, spec.keys);
}

type PeriodAcc = {
  key: string;
  label: string;
  date: string | null;
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4 | null;
  sort: number;
  values: Record<string, number | null>;
};

function periodFromRow(row: Record<string, unknown>, kind: "annual" | "quarterly"): PeriodAcc | null {
  const date = toDate(row.date);
  if (!date) return null;
  const { year, quarter } = fiscalParts(date);
  const dateKey = date.toISOString().slice(0, 10);
  const values: Record<string, number | null> = {};
  for (const spec of [...INCOME_LINES, ...BALANCE_LINES, ...CASHFLOW_LINES]) {
    values[spec.id] = lineValue(spec, row);
  }

  if (kind === "annual") {
    return {
      key: String(year),
      label: `FY${year}`,
      date: dateKey,
      fiscalYear: year,
      quarter: null,
      sort: year,
      values,
    };
  }

  return {
    key: `${year}-Q${quarter}`,
    label: `Q${quarter} ${year}`,
    date: dateKey,
    fiscalYear: year,
    quarter,
    sort: year * 10 + quarter,
    values,
  };
}

function mergePeriod(into: PeriodAcc | undefined, from: PeriodAcc): PeriodAcc {
  if (!into) return from;
  const values = { ...into.values };
  for (const [id, value] of Object.entries(from.values)) {
    if (value != null && values[id] == null) values[id] = value;
  }
  return {
    ...into,
    date: into.date ?? from.date,
    values,
  };
}

function hasAnyValue(period: PeriodAcc): boolean {
  return Object.values(period.values).some((value) => value != null);
}

function buildPeriods(rows: Record<string, unknown>[], kind: "annual" | "quarterly"): PeriodAcc[] {
  const byKey = new Map<string, PeriodAcc>();
  for (const row of rows) {
    const period = periodFromRow(row, kind);
    if (!period) continue;
    byKey.set(period.key, mergePeriod(byKey.get(period.key), period));
  }

  return [...byKey.values()]
    .filter(hasAnyValue)
    .sort((a, b) => a.sort - b.sort);
}

function priorKey(period: PeriodAcc): string {
  if (period.quarter == null) return String(period.fiscalYear - 1);
  return `${period.fiscalYear - 1}-Q${period.quarter}`;
}

function buildTable(periods: PeriodAcc[], lines: LineSpec[], limit: number): FinancialStatementTable {
  const relevant = periods.filter((period) => lines.some((spec) => period.values[spec.id] != null));
  const newestFirst = [...relevant].sort((a, b) => b.sort - a.sort).slice(0, limit);
  const byKey = new Map(periods.map((period) => [period.key, period]));

  const columns: FinancialPeriodColumn[] = newestFirst.map((period) => ({
    key: period.key,
    label: period.label,
    date: period.date,
    fiscalYear: period.fiscalYear,
    quarter: period.quarter,
  }));

  const rows: FinancialStatementRow[] = lines.flatMap((spec) => {
    const cells: FinancialCell[] = newestFirst.map((period) => {
      const value = period.values[spec.id] ?? null;
      const prior = byKey.get(priorKey(period));
      return {
        value,
        yoyPct: yoy(value, prior?.values[spec.id] ?? null),
      };
    });

    if (cells.every((cell) => cell.value == null)) return [];
    return [
      {
        id: spec.id,
        label: spec.label,
        section: spec.section,
        emphasize: spec.emphasize,
        cells,
      },
    ];
  });

  return { columns, rows };
}

function incomeLinesFor(sector: string, periods: PeriodAcc[]): LineSpec[] {
  const hasGross = periods.some((period) => period.values.grossProfit != null);
  const hasNii = periods.some((period) => period.values.netInterestIncome != null);
  const useNii = FINANCIAL_SECTORS.has(sector) || (!hasGross && hasNii);

  return INCOME_LINES.flatMap((line) => {
    if (line.id === "grossProfit") {
      if (useNii) return [];
      return [line];
    }
    if (line.id === "netInterestIncome") {
      if (!useNii) return hasNii ? [line] : [];
      return [{ ...line, label: "Net interest income" }];
    }
    return [line];
  });
}

function buildBundle(periods: PeriodAcc[], limit: number, sector: string): FinancialStatementsBundle {
  return {
    income: buildTable(periods, incomeLinesFor(sector, periods), limit),
    balance: buildTable(periods, BALANCE_LINES, limit),
    cashflow: buildTable(periods, CASHFLOW_LINES, limit),
  };
}

export async function getFinancialStatements(entry: UniverseEntry): Promise<FinancialStatementsPayload> {
  const [annualRows, quarterlyRows, quotes] = await Promise.all([
    loadAllModules(entry.symbol, "annual"),
    loadQuarterlyStatements(entry.symbol),
    fetchQuotes([entry.symbol]).catch(() => []),
  ]);

  return {
    source: "yahoo",
    symbol: entry.symbol,
    company: entry.name,
    currency: quotes[0]?.currency ?? "MYR",
    asOf: new Date().toISOString(),
    annual: buildBundle(buildPeriods(annualRows, "annual"), MAX_ANNUAL, entry.sector),
    quarterly: buildBundle(buildPeriods(quarterlyRows, "quarterly"), MAX_QUARTERS, entry.sector),
  };
}
