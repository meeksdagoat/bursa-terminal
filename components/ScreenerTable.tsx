"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExportCsvButton } from "@/components/export-csv-button";
import { stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { csvFilename, useExportToCSV } from "@/hooks/useExportToCSV";
import { changeClass, formatMarketCap, formatRatio, formatUnsignedPct } from "@/lib/format";
import type { ScreenerSortKey } from "@/lib/screener-filters";
import type { ScreenerRow } from "@/lib/types";
import { terminalHref } from "@/lib/universe";

type ScreenerTableProps = {
  rows: ScreenerRow[];
  sortKey: ScreenerSortKey;
  sortDir: "asc" | "desc";
  query: string;
  onQuery: (query: string) => void;
  onSort: (key: ScreenerSortKey) => void;
};

const COLUMNS: { key: ScreenerSortKey; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Ticker", align: "left" },
  { key: "name", label: "Name", align: "left" },
  { key: "sector", label: "Sector", align: "left" },
  { key: "pe", label: "P/E", align: "right" },
  { key: "dividendYieldPct", label: "Div yield", align: "right" },
  { key: "marketCap", label: "Mkt cap", align: "right" },
  { key: "roe", label: "ROE", align: "right" },
  { key: "shariah", label: "Shariah", align: "right" },
];

export function ScreenerTable({
  rows,
  sortKey,
  sortDir,
  query,
  onQuery,
  onSort,
}: ScreenerTableProps) {
  const router = useRouter();
  const exportCsv = useExportToCSV();

  function openOnBursaMy(symbol: string) {
    router.push(terminalHref(symbol));
  }

  return (
    <section className="min-w-0 flex-1 overflow-hidden border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          Results
        </h2>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-md">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Search company name or stock code</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search name or code — Maybank / 1155"
              className="min-h-11 w-full border border-line bg-[#0e0e0e] px-2 font-mono text-[12px] text-neutral-100 placeholder:text-neutral-600 md:min-h-9"
            />
          </label>
          <ExportCsvButton
            disabled={rows.length === 0}
            onClick={() =>
              exportCsv(csvFilename("Screener"), [
                ["Ticker", "Name", "Sector", "P/E", "Div yield %", "Market cap", "ROE %", "Shariah"],
                ...rows.map((row) => [
                  row.code,
                  row.name,
                  row.sector,
                  row.pe,
                  row.dividendYieldPct,
                  row.marketCap,
                  row.roe,
                  row.shariah ? "Yes" : "No",
                ]),
              ])
            }
          />
        </div>
      </div>

      <div className="max-h-[min(70vh,720px)] overflow-auto overscroll-contain">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={`${column.key === "symbol" ? stickyHeadClass : tableHeadClass} ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex min-h-11 items-center gap-1 uppercase tracking-[0.12em] md:min-h-0"
                  >
                    {column.label}
                    <SortMark active={sortKey === column.key} direction={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-8 text-center font-mono text-[10px] uppercase tracking-wider text-neutral-600"
                >
                  No names match these filters
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.symbol}
                  role="link"
                  tabIndex={0}
                  title={`Open ${row.name} on Bursa MY`}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) return;
                    openOnBursaMy(row.symbol);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openOnBursaMy(row.symbol);
                  }}
                  className={`cursor-pointer ${
                    index % 2 === 1 ? "bg-[#101010] hover:bg-[#161616]" : "hover:bg-[#161616]"
                  }`}
                >
                  <td className={`${stickyCellClass} font-mono text-gain`}>
                    <Link
                      href={terminalHref(row.symbol)}
                      className="inline-flex min-h-11 items-center hover:underline md:min-h-0"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className={`${tableCellClass} max-w-[180px] truncate text-left text-neutral-100`}>
                    {row.name}
                  </td>
                  <td className={`${tableCellClass} max-w-[140px] truncate text-left text-neutral-400`}>
                    {row.sector}
                  </td>
                  <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                    {formatRatio(row.pe)}
                  </td>
                  <td
                    className={`${tableCellClass} text-right font-mono ${changeClass(row.dividendYieldPct)}`}
                  >
                    {formatUnsignedPct(row.dividendYieldPct)}
                  </td>
                  <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                    {formatMarketCap(row.marketCap)}
                  </td>
                  <td className={`${tableCellClass} text-right font-mono ${changeClass(row.roe)}`}>
                    {formatUnsignedPct(row.roe)}
                  </td>
                  <td className={`${tableCellClass} text-right`}>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider ${
                        row.shariah ? "text-gain" : "text-neutral-600"
                      }`}
                    >
                      {row.shariah ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortMark({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  if (!active) {
    return <span className="font-mono text-neutral-700">↕</span>;
  }
  return <span className="font-mono text-gain">{direction === "asc" ? "↑" : "↓"}</span>;
}
