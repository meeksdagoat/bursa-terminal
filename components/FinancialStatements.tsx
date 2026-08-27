"use client";

import { useMemo, useState } from "react";
import { ExportCsvButton } from "@/components/export-csv-button";
import { stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { FinancialGridSkeleton } from "@/components/skeleton";
import { csvFilename, useExportToCSV } from "@/hooks/useExportToCSV";
import { changeClass, formatCompact, formatEps, formatPct } from "@/lib/format";
import type {
  FinancialCell,
  FinancialPeriodKind,
  FinancialStatementKind,
  FinancialStatementRow,
  FinancialStatementTable,
  FinancialStatementsPayload,
} from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 30 * 60 * 1000;

const STATEMENT_TABS: { id: FinancialStatementKind; label: string }[] = [
  { id: "income", label: "Income Statement" },
  { id: "balance", label: "Balance Sheet" },
  { id: "cashflow", label: "Cash Flow" },
];

type FinancialStatementsProps = {
  symbol: string;
  companyName: string;
};

export function FinancialStatements({ symbol, companyName }: FinancialStatementsProps) {
  const [period, setPeriod] = useState<FinancialPeriodKind>("annual");
  const [statement, setStatement] = useState<FinancialStatementKind>("income");
  const url = `/api/stock/${encodeURIComponent(symbol)}/financials`;
  const { data, error, loading } = useLiveData<FinancialStatementsPayload>(url, REFRESH_MS);
  const exportCsv = useExportToCSV();

  const ready = data?.symbol === symbol;
  const payload = ready ? data : null;
  const pending = !ready || (loading && !payload);
  const table = payload ? payload[period][statement] : null;

  const kpis = useMemo(() => (payload ? keyMetrics(payload[period]) : []), [payload, period]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="no-scrollbar flex w-full items-center justify-between gap-2 overflow-x-auto border-b border-line px-3 py-2 sm:px-4">
        <div role="tablist" aria-label="Reporting period" className="flex shrink-0 items-center">
          <PeriodTab
            label="Annual"
            selected={period === "annual"}
            onSelect={() => setPeriod("annual")}
          />
          <PeriodTab
            label="Quarterly"
            selected={period === "quarterly"}
            onSelect={() => setPeriod("quarterly")}
          />
        </div>
        <p className="shrink-0 whitespace-nowrap font-mono text-xs uppercase tracking-wider text-neutral-400">
          {payload
            ? `YAHOO · ${payload.currency} · ${payload.symbol}`
            : `HISTORICAL STATEMENTS · ${symbol}`}
        </p>
        {table ? (
          <ExportCsvButton
            onClick={() =>
              exportCsv(
                csvFilename(companyName, "Financials", period),
                statementCsvRows(table),
              )
            }
          />
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Financial statement"
        className="grid grid-cols-3 border-b border-line"
      >
        {STATEMENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statement === tab.id}
            onClick={() => setStatement(tab.id)}
            className={`min-h-11 border-b-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] md:min-h-9 ${
              statement === tab.id
                ? "border-gain bg-[#1a1a1a] text-gain"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <span className="md:hidden">{shortStatementLabel(tab.id)}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {error && !payload ? (
        <p className="px-2.5 py-3 font-mono text-[10px] leading-relaxed text-neutral-600">
          FINANCIALS FEED UNAVAILABLE · {error}
        </p>
      ) : pending ? (
        <>
          <KpiSkeletonStrip />
          <FinancialGridSkeleton rows={8} cols={5} />
        </>
      ) : !table || table.columns.length === 0 ? (
        <p className="px-2.5 py-3 font-mono text-[10px] leading-relaxed text-neutral-600">
          NO REPORTED {period.toUpperCase()} {statementLabel(statement).toUpperCase()} FOR{" "}
          {companyName.toUpperCase()}
        </p>
      ) : (
        <>
          <KeyMetricsStrip rows={kpis} />
          <StatementGrid table={table} />
        </>
      )}
    </div>
  );
}

function StatementGrid({ table }: { table: FinancialStatementTable }) {
  const sections = groupRows(table.rows);

  return (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
        <thead>
          <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            <th className={`${stickyHeadClass} text-left`}>Line item</th>
            {table.columns.map((column) => (
              <th key={column.key} className={`${tableHeadClass} text-right`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) =>
            section.rows.map((row, index) => (
              <StatementRow
                key={row.id}
                row={row}
                index={index}
                showSection={index === 0}
                colSpan={table.columns.length + 1}
              />
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function groupRows(rows: FinancialStatementRow[]): Array<{ section: string; rows: FinancialStatementRow[] }> {
  const sections: Array<{ section: string; rows: FinancialStatementRow[] }> = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last && last.section === row.section) {
      last.rows.push(row);
    } else {
      sections.push({ section: row.section, rows: [row] });
    }
  }
  return sections;
}

function StatementRow({
  row,
  index,
  showSection,
  colSpan,
}: {
  row: FinancialStatementRow;
  index: number;
  showSection: boolean;
  colSpan: number;
}) {
  return (
    <>
      {showSection ? (
        <tr>
          <td
            colSpan={colSpan}
            className="bg-[#0e0e0e] px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-600 md:px-2"
          >
            {row.section}
          </td>
        </tr>
      ) : null}
      <tr className={index % 2 === 1 ? "bg-[#101010] hover:bg-[#161616]" : "hover:bg-[#161616]"}>
        <th
          scope="row"
          className={`${stickyCellClass} ${
            row.emphasize ? "font-semibold text-neutral-100" : "font-medium text-neutral-300"
          }`}
        >
          {row.label}
        </th>
        {row.cells.map((cell, cellIndex) => (
          <td key={`${row.id}-${cellIndex}`} className={`${tableCellClass} text-right`}>
            <StatementCell cell={cell} lineId={row.id} emphasize={row.emphasize} />
          </td>
        ))}
      </tr>
    </>
  );
}

function StatementCell({
  cell,
  lineId,
  emphasize,
}: {
  cell: FinancialCell;
  lineId: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`font-mono tabular-nums ${
          cell.value == null ? "text-neutral-600" : emphasize ? "text-neutral-100" : "text-neutral-200"
        }`}
      >
        {formatLineValue(lineId, cell.value)}
      </span>
      {cell.yoyPct != null ? (
        <span className={`font-mono text-[10px] tabular-nums ${changeClass(cell.yoyPct)}`}>
          {formatPct(cell.yoyPct)}
        </span>
      ) : (
        <span className="font-mono text-[10px] text-transparent">—</span>
      )}
    </div>
  );
}

function KeyMetricsStrip({
  rows,
}: {
  rows: Array<{ id: string; label: string; cell: FinancialCell }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border-b border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((row) => (
        <div key={row.id} className="min-w-0 bg-panel px-2.5 py-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{row.label}</p>
          <p className="mt-0.5 truncate font-mono text-[13px] tabular-nums text-neutral-100">
            {formatLineValue(row.id, row.cell.value)}
          </p>
          <p className={`font-mono text-[10px] tabular-nums ${changeClass(row.cell.yoyPct)}`}>
            {row.cell.yoyPct == null ? "—" : formatPct(row.cell.yoyPct)} YoY
          </p>
        </div>
      ))}
    </div>
  );
}

function KpiSkeletonStrip() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border-b border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="bg-panel px-2.5 py-2">
          <div className="h-2.5 w-16 animate-pulse rounded-sm bg-zinc-800/60" />
          <div className="mt-2 h-3.5 w-20 animate-pulse rounded-sm bg-zinc-800/60" />
          <div className="mt-1.5 h-2.5 w-12 animate-pulse rounded-sm bg-zinc-800/60" />
        </div>
      ))}
    </div>
  );
}

function PeriodTab({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`min-h-11 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] md:min-h-0 md:py-1 ${
        selected ? "text-gain" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

function keyMetrics(bundle: FinancialStatementsPayload["annual"]) {
  const latest = (id: string, from: FinancialStatementTable) => {
    const row = from.rows.find((item) => item.id === id);
    const cell = row?.cells[0];
    if (!row || !cell || cell.value == null) return null;
    return { id, label: row.label, cell };
  };

  return [
    latest("revenue", bundle.income),
    latest("netIncome", bundle.income),
    latest("grossProfit", bundle.income) ?? latest("netInterestIncome", bundle.income),
    latest("totalDebt", bundle.balance),
    latest("freeCashFlow", bundle.cashflow),
  ].filter((row): row is { id: string; label: string; cell: FinancialCell } => row != null);
}

function formatLineValue(lineId: string, value: number | null): string {
  if (lineId === "dilutedEps") return formatEps(value);
  return formatCompact(value);
}

function statementLabel(kind: FinancialStatementKind): string {
  if (kind === "income") return "income statement";
  if (kind === "balance") return "balance sheet";
  return "cash flow";
}

function shortStatementLabel(kind: FinancialStatementKind): string {
  if (kind === "income") return "Income";
  if (kind === "balance") return "Balance";
  return "Cash flow";
}

function statementCsvRows(table: FinancialStatementTable): Array<Array<string | number | null>> {
  return [
    ["Line item", ...table.columns.map((column) => column.label)],
    ...table.rows.map((row) => [row.label, ...row.cells.map((cell) => cell.value)]),
  ];
}
