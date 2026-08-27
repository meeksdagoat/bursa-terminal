"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { TableSkeleton } from "@/components/skeleton";
import {
  changeClass,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatRatio,
  formatUnsignedPct,
} from "@/lib/format";
import type { BursaQuote } from "@/lib/types";
import { entryBySymbol, sectorPeers, terminalHref } from "@/lib/universe";

const PEER_COUNT = 4;

type PeerColumn = BursaQuote & {
  code: string;
  shortName: string;
  shariah: boolean;
};

type MetricKey = "price" | "change" | "pe" | "yield" | "mcap" | "pb" | "shariah";

type PeerComparisonProps = {
  currentTicker: string;
};

export function PeerComparison({ currentTicker }: PeerComparisonProps) {
  const peerTickers = useMemo(() => sectorPeers(currentTicker, PEER_COUNT), [currentTicker]);
  const symbols = useMemo(
    () => [...new Set([currentTicker, ...peerTickers])],
    [currentTicker, peerTickers],
  );

  const [rows, setRows] = useState<PeerColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      const results = await Promise.all(
        symbols.map(async (ticker) => {
          try {
            const response = await fetch(`/api/bursa?symbol=${encodeURIComponent(ticker)}`, {
              signal: controller.signal,
            });
            const payload: unknown = await response.json();
            if (!response.ok) return null;
            if (!payload || typeof payload !== "object" || !("symbol" in payload)) return null;
            return hydrate(payload as BursaQuote);
          } catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError") return null;
            return null;
          }
        }),
      );

      if (cancelled) return;
      const quotes = results.filter((row): row is PeerColumn => row != null);
      const ordered = [
        ...quotes.filter((row) => row.symbol === currentTicker),
        ...quotes.filter((row) => row.symbol !== currentTicker),
      ];
      setRows(ordered);
      setLoading(false);
      if (quotes.length === 0) setError("YAHOO QUOTESUMMARY RETURNED NO ROWS");
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbols, currentTicker]);

  const sector = entryBySymbol(currentTicker)?.sector ?? "sector";
  const winners = useMemo(() => bestInSector(rows), [rows]);

  return (
    <div className="flex min-h-0 flex-col bg-[#121212]">
      <p className="border-b border-line px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-600">
        {sector} · {rows.length}/{symbols.length} quoted · green = best in set
      </p>

      {loading ? (
        <TableSkeleton rows={8} cols={Math.min(5, symbols.length + 1)} />
      ) : error ? (
        <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
          NO SECTOR PEERS FOR {currentTicker}
        </p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <th className={`${stickyHeadClass} text-left`}>Metric</th>
                {rows.map((row) => {
                  const current = row.symbol === currentTicker;
                  return (
                    <th
                      key={row.symbol}
                      className={`${tableHeadClass} text-right ${current ? "text-gain" : ""}`}
                    >
                      <Link
                        href={terminalHref(row.symbol)}
                        title={`Open ${row.shortName} in the market terminal`}
                        className="inline-flex min-h-11 flex-col items-end justify-center hover:underline md:min-h-0"
                      >
                        <span>{row.code}</span>
                        <span className="font-sans text-[10px] font-medium normal-case tracking-normal text-neutral-300">
                          {row.shortName}
                        </span>
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric, index) => (
                <tr key={metric.key} className={index % 2 === 1 ? "bg-[#101010]" : "bg-[#121212]"}>
                  <td className={`${stickyCellClass} text-left font-mono text-[10px] uppercase tracking-wider text-neutral-500`}>
                    {metric.label}
                  </td>
                  {rows.map((row) => {
                    const current = row.symbol === currentTicker;
                    const value = cellValue(row, metric.key);
                    const winner = winners.get(metric.key);
                    const best =
                      winner != null && value != null && Number.isFinite(value) && winner === value;
                    return (
                      <td
                        key={row.symbol}
                        className={`${tableCellClass} text-right font-mono ${
                          current ? "bg-gain/[0.06]" : ""
                        } ${cellTone(row, metric.key, best)}`}
                      >
                        {formatCell(row, metric.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "price", label: "Share price" },
  { key: "change", label: "Daily change %" },
  { key: "pe", label: "P/E ratio" },
  { key: "yield", label: "Dividend yield %" },
  { key: "mcap", label: "Market cap (MYR)" },
  { key: "pb", label: "Price-to-book" },
  { key: "shariah", label: "Shariah status" },
];

const BEST_GLOW = "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,160,0.45)]";

function hydrate(quote: BursaQuote): PeerColumn | null {
  const entry = entryBySymbol(quote.symbol);
  if (!entry) return null;
  return {
    ...quote,
    code: entry.code,
    shortName: entry.shortName,
    shariah: entry.shariah,
  };
}

function cellValue(row: PeerColumn, key: MetricKey): number | null {
  switch (key) {
    case "price":
      return row.price;
    case "change":
      return row.dayChangePercent;
    case "pe":
      return row.peRatio;
    case "yield":
      return row.dividendYield;
    case "mcap":
      return row.marketCap;
    case "pb":
      return row.priceToBook;
    case "shariah":
      return null;
  }
}

function formatCell(row: PeerColumn, key: MetricKey): string {
  switch (key) {
    case "price":
      return formatPrice(row.price);
    case "change":
      return formatPct(row.dayChangePercent);
    case "pe":
      return formatRatio(row.peRatio);
    case "yield":
      return formatUnsignedPct(row.dividendYield);
    case "mcap":
      return formatMarketCap(row.marketCap);
    case "pb":
      return row.priceToBook != null && Number.isFinite(row.priceToBook)
        ? row.priceToBook.toFixed(2)
        : "—";
    case "shariah":
      return row.shariah ? "Yes" : "No";
  }
}

function cellTone(row: PeerColumn, key: MetricKey, best: boolean): string {
  if (best && key !== "shariah" && key !== "price") return BEST_GLOW;
  if (key === "change") return changeClass(row.dayChangePercent);
  if (key === "shariah") return row.shariah ? "text-gain" : "text-neutral-600";
  return "text-neutral-200";
}

function bestInSector(rows: PeerColumn[]): Map<MetricKey, number> {
  const winners = new Map<MetricKey, number>();
  pick(winners, rows, "change", "max");
  pick(winners, rows, "pe", "min");
  pick(winners, rows, "yield", "max");
  pick(winners, rows, "pb", "min");
  return winners;
}

function pick(
  into: Map<MetricKey, number>,
  rows: PeerColumn[],
  key: MetricKey,
  direction: "min" | "max",
) {
  const values = rows
    .map((row) => cellValue(row, key))
    .filter((value): value is number => value != null && Number.isFinite(value) && (key === "change" || value > 0));
  if (values.length === 0) return;
  into.set(key, direction === "min" ? Math.min(...values) : Math.max(...values));
}
