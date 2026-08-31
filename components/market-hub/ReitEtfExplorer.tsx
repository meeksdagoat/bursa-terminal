"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  changeClass,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatRatio,
  formatVolume,
} from "@/lib/format";
import { sanitizeReitDistributionYield } from "@/lib/reit-yield";
import type { MarketHubEtfRow, MarketHubReitRow } from "@/lib/types";
import { terminalHref } from "@/lib/universe";

type ReitEtfExplorerProps = {
  reits: MarketHubReitRow[];
  etfs: MarketHubEtfRow[];
  filter: string;
};

type Tab = "reits" | "etfs";
type SortDir = "asc" | "desc";
type ReitSort = "distributionYieldPct" | "priceToNav" | "reitSector" | "name" | "marketCap";
type EtfSort = "expenseRatioPct" | "assetClass" | "name" | "changePct";

const REIT_SORT_OPTIONS: { key: ReitSort; label: string }[] = [
  { key: "distributionYieldPct", label: "Dividend Yield" },
  { key: "priceToNav", label: "P/NAV Ratio" },
  { key: "reitSector", label: "Sector" },
  { key: "name", label: "Name" },
  { key: "marketCap", label: "Market Cap" },
];

const ETF_SORT_OPTIONS: { key: EtfSort; label: string }[] = [
  { key: "expenseRatioPct", label: "Expense Ratio" },
  { key: "assetClass", label: "Asset Class" },
  { key: "changePct", label: "1D %" },
  { key: "name", label: "Name" },
];

const inactivePill =
  "px-2.5 py-1 rounded bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/50 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap";
const activePill =
  "px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap";

function SortToolbar<K extends string>({
  options,
  active,
  direction,
  onSelect,
}: {
  options: { key: K; label: string }[];
  active: K;
  direction: SortDir;
  onSelect: (key: K) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900/50 px-3 py-2.5 font-mono text-xs text-neutral-400">
      <span className="shrink-0 uppercase tracking-[0.12em]">Sort by:</span>
      <div className="no-scrollbar -mx-0.5 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap px-0.5">
        {options.map((option) => {
          const selected = active === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect(option.key)}
              aria-pressed={selected}
              className={selected ? activePill : inactivePill}
            >
              <span>{option.label}</span>
              {selected ? (
                <span className="text-[10px] leading-none" aria-hidden>
                  {direction === "desc" ? "▼" : "▲"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function compareText(a: string, b: string, direction: SortDir): number {
  const ranked = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "asc" ? ranked : -ranked;
}

function compareNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDir,
): number {
  const left = a ?? (direction === "asc" ? Infinity : -Infinity);
  const right = b ?? (direction === "asc" ? Infinity : -Infinity);
  return direction === "asc" ? left - right : right - left;
}

export function ReitEtfExplorer({ reits, etfs, filter }: ReitEtfExplorerProps) {
  const [tab, setTab] = useState<Tab>("reits");
  const [reitSort, setReitSort] = useState<ReitSort>("distributionYieldPct");
  const [reitDir, setReitDir] = useState<SortDir>("desc");
  const [etfSort, setEtfSort] = useState<EtfSort>("assetClass");
  const [etfDir, setEtfDir] = useState<SortDir>("asc");

  const needle = filter.trim().toLowerCase();

  const reitRows = useMemo(() => {
    const normalized = reits.map((row) => ({
      ...row,
      distributionYieldPct: sanitizeReitDistributionYield(row.distributionYieldPct),
    }));

    const filtered = needle
      ? normalized.filter(
          (row) =>
            row.name.toLowerCase().includes(needle) ||
            row.code.toLowerCase().includes(needle) ||
            row.reitSector.toLowerCase().includes(needle),
        )
      : normalized;

    return [...filtered].sort((a, b) => {
      if (reitSort === "name" || reitSort === "reitSector") {
        return compareText(a[reitSort], b[reitSort], reitDir);
      }
      return compareNumber(a[reitSort], b[reitSort], reitDir);
    });
  }, [reits, needle, reitSort, reitDir]);

  const etfRows = useMemo(() => {
    const filtered = needle
      ? etfs.filter(
          (row) =>
            row.name.toLowerCase().includes(needle) ||
            row.code.toLowerCase().includes(needle) ||
            row.assetClass.toLowerCase().includes(needle),
        )
      : etfs;

    return [...filtered].sort((a, b) => {
      if (etfSort === "name" || etfSort === "assetClass") {
        return compareText(a[etfSort], b[etfSort], etfDir);
      }
      return compareNumber(a[etfSort], b[etfSort], etfDir);
    });
  }, [etfs, needle, etfSort, etfDir]);

  function handleReitSort(key: ReitSort) {
    if (key === reitSort) {
      setReitDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setReitSort(key);
    setReitDir(key === "name" || key === "reitSector" ? "asc" : "desc");
  }

  function handleEtfSort(key: EtfSort) {
    if (key === etfSort) {
      setEtfDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setEtfSort(key);
    setEtfDir(key === "name" || key === "assetClass" || key === "expenseRatioPct" ? "asc" : "desc");
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Income &amp; Funds
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Malaysian REITs and exchange-traded funds
          </p>
        </div>
        <div className="flex border border-neutral-800">
          <button
            type="button"
            onClick={() => setTab("reits")}
            className={`min-h-11 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] md:min-h-0 md:py-2 ${
              tab === "reits" ? "bg-gain/15 text-gain" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            M-REITs Screener
          </button>
          <button
            type="button"
            onClick={() => setTab("etfs")}
            className={`min-h-11 border-l border-neutral-800 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] md:min-h-0 md:py-2 ${
              tab === "etfs" ? "bg-gain/15 text-gain" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            ETFs Explorer
          </button>
        </div>
      </header>

      {tab === "reits" ? (
        <div className="overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
          <SortToolbar
            options={REIT_SORT_OPTIONS}
            active={reitSort}
            direction={reitDir}
            onSelect={handleReitSort}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr className="border-b border-neutral-800 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Yield %</th>
                  <th className="px-3 py-2 text-right">P/NAV</th>
                  <th className="px-3 py-2 text-right">Mkt cap</th>
                </tr>
              </thead>
              <tbody>
                {reitRows.map((row) => (
                  <tr key={row.symbol} className="border-b border-neutral-900 hover:bg-[#121212]">
                    <td className="px-3 py-2 font-mono text-[12px] text-gain">
                      <Link href={terminalHref(row.symbol)} className="hover:underline">
                        {row.code}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[12px] text-neutral-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                      {row.reitSector}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-200">
                      {formatPrice(row.price)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-[12px] ${changeClass(row.distributionYieldPct)}`}
                    >
                      {formatPct(row.distributionYieldPct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-200">
                      {formatRatio(row.priceToNav)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-neutral-400">
                      {formatMarketCap(row.marketCap)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
          <SortToolbar
            options={ETF_SORT_OPTIONS}
            active={etfSort}
            direction={etfDir}
            onSelect={handleEtfSort}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr className="border-b border-neutral-800 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2 text-right">Expense %</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">1D %</th>
                  <th className="px-3 py-2 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {etfRows.map((row) => (
                  <tr key={row.symbol} className="border-b border-neutral-900 hover:bg-[#121212]">
                    <td className="px-3 py-2 font-mono text-[12px] text-gain">{row.code}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-[12px] text-neutral-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="border border-neutral-800 bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-300">
                        {row.assetClass}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-200">
                      {row.expenseRatioPct != null ? row.expenseRatioPct.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-200">
                      {formatPrice(row.price)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-[12px] ${changeClass(row.changePct)}`}
                    >
                      {formatPct(row.changePct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-neutral-400">
                      {formatVolume(row.volume)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
