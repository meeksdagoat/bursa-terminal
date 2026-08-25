"use client";

import { useEffect, useMemo, useState } from "react";
import { stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { TableSkeleton } from "@/components/skeleton";
import {
  changeClass,
  formatKlFullDate,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatRatio,
} from "@/lib/format";
import type { BursaQuote } from "@/lib/types";

type DeepDiveTab = "peers" | "calendar";

export type StockDeepDivePanelProps = {
  currentTicker: string;
  peerTickers: string[];
};

type CalendarAction = {
  id: string;
  symbol: string;
  companyName: string;
  label: string;
  at: string;
  upcoming: boolean;
};

export function StockDeepDivePanel({ currentTicker, peerTickers }: StockDeepDivePanelProps) {
  const [tab, setTab] = useState<DeepDiveTab>("peers");
  const [rows, setRows] = useState<BursaQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const symbols = useMemo(
    () => [...new Set([currentTicker, ...peerTickers])],
    [currentTicker, peerTickers],
  );

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
            return payload as BursaQuote;
          } catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError") return null;
            return null;
          }
        }),
      );

      if (cancelled) return;
      const quotes = results.filter((row): row is BursaQuote => row != null);
      setRows(quotes);
      setLoading(false);
      if (quotes.length === 0) setError("YAHOO QUOTESUMMARY RETURNED NO ROWS");
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbols]);

  const actions = useMemo(() => buildCalendar(rows), [rows]);
  const current = rows.find((row) => row.symbol === currentTicker) ?? null;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-px border-b border-line px-2 py-1">
        <SubTab active={tab === "peers"} onClick={() => setTab("peers")} label="Peer comparison" />
        <SubTab
          active={tab === "calendar"}
          onClick={() => setTab("calendar")}
          label="Corporate actions"
        />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-neutral-700">
          YAHOO LIVE · {rows.length}/{symbols.length}
        </span>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">{error}</p>
      ) : tab === "peers" ? (
        <PeerMatrix rows={orderRows(rows, currentTicker)} currentTicker={currentTicker} />
      ) : (
        <ActionCalendar actions={actions} currentTicker={currentTicker} focus={current} />
      )}
    </div>
  );
}

function PeerMatrix({
  rows,
  currentTicker,
}: {
  rows: BursaQuote[];
  currentTicker: string;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
        <thead>
          <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            <th className={`${stickyHeadClass} text-left`}>Ticker</th>
            <th className={`${tableHeadClass} text-left`}>Company</th>
            <th className={`${tableHeadClass} text-right`}>Price (MYR)</th>
            <th className={`${tableHeadClass} text-right`}>Day chg</th>
            <th className={`${tableHeadClass} text-right`}>Mkt cap</th>
            <th className={`${tableHeadClass} text-right`}>P/E</th>
            <th className={`${tableHeadClass} text-right`}>Div yld</th>
            <th className={`${tableHeadClass} text-right`}>ROE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const current = row.symbol === currentTicker;
            return (
              <tr
                key={row.symbol}
                className={`${index % 2 === 1 ? "bg-[#101010]" : ""} ${
                  current ? "bg-gain/[0.07]" : "hover:bg-[#161616]"
                }`}
              >
                <td
                  className={`${stickyCellClass} font-mono text-neutral-100 ${
                    current ? "border-l-2 border-gain" : "border-l-2 border-transparent"
                  }`}
                >
                  {row.symbol.replace(/\.KL$/, "")}
                </td>
                <td className={`${tableCellClass} max-w-[160px] truncate text-left text-neutral-200`}>
                  {row.companyName}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-100`}>
                  {formatPrice(row.price)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${changeClass(row.dayChangePercent)}`}
                >
                  {formatPct(row.dayChangePercent)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatMarketCap(row.marketCap)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatRatio(row.peRatio)}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
                  {formatPlainPct(row.dividendYield)}
                </td>
                <td
                  className={`${tableCellClass} text-right font-mono ${changeClass(row.roe)}`}
                >
                  {formatPlainPct(row.roe)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActionCalendar({
  actions,
  currentTicker,
  focus,
}: {
  actions: CalendarAction[];
  currentTicker: string;
  focus: BursaQuote | null;
}) {
  if (actions.length === 0) {
    return (
      <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">
        NO EX-DIVIDEND OR EARNINGS DATES RETURNED FOR {currentTicker}
        {focus?.companyName ? ` · ${focus.companyName.toUpperCase()}` : ""}
      </p>
    );
  }

  return (
    <ol className="divide-y divide-line">
      {actions.map((item) => (
        <li
          key={item.id}
          className={`px-2.5 py-2 ${
            item.symbol === currentTicker ? "border-l-2 border-gain bg-gain/[0.06]" : "hover:bg-[#161616]"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[86px] shrink-0 font-mono text-[10px] text-neutral-500">
              {formatKlFullDate(item.at)}
            </span>
            <span
              className={`shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${
                item.upcoming
                  ? "border-gain/45 bg-gain/10 text-gain"
                  : "border-line bg-[#161616] text-neutral-500"
              }`}
            >
              {item.upcoming ? "Upcoming" : "Historical"}
            </span>
            <span className="rounded-sm border border-line px-1 py-px font-mono text-[9px] uppercase tracking-wider text-amber-400/90">
              {item.label}
            </span>
            <span className="font-mono text-[10px] text-neutral-500">{item.symbol}</span>
            <span className="min-w-0 text-[12px] font-medium text-neutral-100">{item.companyName}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SubTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 px-2 font-mono text-[9px] uppercase tracking-wider md:min-h-0 md:py-0.5 ${
        active ? "text-gain" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

function orderRows(rows: BursaQuote[], currentTicker: string): BursaQuote[] {
  return [...rows].sort((a, b) => {
    if (a.symbol === currentTicker) return -1;
    if (b.symbol === currentTicker) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

function buildCalendar(rows: BursaQuote[]): CalendarAction[] {
  const start = startOfKlToday();
  const items: CalendarAction[] = [];

  for (const row of rows) {
    if (row.exDividendAt) {
      items.push({
        id: `${row.symbol}:exdiv:${row.exDividendAt}`,
        symbol: row.symbol,
        companyName: row.companyName,
        label: "Ex-dividend",
        at: row.exDividendAt,
        upcoming: Date.parse(row.exDividendAt) >= start,
      });
    }
    if (row.dividendAt && row.dividendAt !== row.exDividendAt) {
      items.push({
        id: `${row.symbol}:div:${row.dividendAt}`,
        symbol: row.symbol,
        companyName: row.companyName,
        label: "Dividend",
        at: row.dividendAt,
        upcoming: Date.parse(row.dividendAt) >= start,
      });
    }
    for (const at of row.earningsAt) {
      items.push({
        id: `${row.symbol}:earn:${at}`,
        symbol: row.symbol,
        companyName: row.companyName,
        label: "Earnings",
        at,
        upcoming: Date.parse(at) >= start,
      });
    }
  }

  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function startOfKlToday(): number {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return Date.parse(`${day}T00:00:00+08:00`);
}

function formatPlainPct(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? `${value.toFixed(2)}%` : "—";
}
