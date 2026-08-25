"use client";

import { memo, useState } from "react";
import { ShowMoreBar, stickyCellClass, stickyHeadClass, tableCellClass, tableHeadClass } from "@/components/h-scroll";
import { TableSkeleton } from "@/components/skeleton";
import { changeClass, formatKlFullDate, formatPct, formatVolume } from "@/lib/format";
import type { StructuredWarrant, WarrantsPayload } from "@/lib/types";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 60 * 1000;
const PAGE_SIZE = 24;

const warrantPriceFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

type WarrantsPanelProps = {
  symbol: string;
  companyName: string;
};

function WarrantsPanelInner({ symbol, companyName }: WarrantsPanelProps) {
  const url = `/api/warrants?symbol=${encodeURIComponent(symbol)}`;
  const { data, error, loading } = useLiveData<WarrantsPayload>(url, REFRESH_MS);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const ready = data?.symbol === symbol;
  const payload = ready ? data : null;
  const items = payload?.items ?? [];
  const pending = !ready || (loading && !payload);
  const visible = items.slice(0, limit);

  if (error && !payload) {
    return <p className="px-2.5 py-3 font-mono text-[10px] text-neutral-600">WARRANTS FEED UNAVAILABLE · {error}</p>;
  }
  if (pending) {
    return <TableSkeleton rows={8} cols={6} />;
  }

  return (
    <div className="flex flex-col gap-2 px-2.5 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-600">
        STRUCTURED WARRANTS · {items.some((row) => row.quoteSource === "yahoo") ? "YAHOO" : "KLSE SCREENER"} ·{" "}
        {symbol} · {items.length}
      </p>
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x border border-line">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <th className={`${stickyHeadClass} text-left`}>Warrant code</th>
              <th className={`${tableHeadClass} text-left`}>Type</th>
              <th className={`${tableHeadClass} text-right`}>Last (MYR)</th>
              <th className={`${tableHeadClass} text-right`}>Day change</th>
              <th className={`${tableHeadClass} text-right`}>Volume</th>
              <th className={`${tableHeadClass} text-right`}>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-2 py-3 font-mono text-[10px] uppercase tracking-wider text-neutral-600"
                >
                  No listed structured warrants
                </td>
              </tr>
            ) : (
              visible.map((row, index) => <WarrantRow key={row.code} row={row} stripe={index % 2 === 1} />)
            )}
          </tbody>
        </table>
      </div>
      <ShowMoreBar remaining={items.length - visible.length} onClick={() => setLimit((n) => n + PAGE_SIZE)} />
    </div>
  );
}

function WarrantRow({ row, stripe }: { row: StructuredWarrant; stripe: boolean }) {
  const call = row.type === "Call";
  return (
    <tr className={`${stripe ? "bg-[#101010]" : ""} hover:bg-[#161616]`}>
      <td
        className={`${stickyCellClass} border-l-2 ${call ? "border-l-gain/70" : "border-l-loss/70"}`}
      >
        <span className={`font-mono ${call ? "text-gain" : "text-loss"}`}>{row.code}</span>
        {row.name ? (
          <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-neutral-600">{row.name}</span>
        ) : null}
      </td>
      <td className={`${tableCellClass} text-left`}>
        <span
          className={`rounded-sm border px-1 py-px font-mono text-[9px] tracking-wider ${
            call ? "border-gain/40 text-gain" : "border-loss/40 text-loss"
          }`}
        >
          {row.type}
        </span>
      </td>
      <td className={`${tableCellClass} text-right font-mono text-neutral-200`}>
        {row.lastPrice == null ? "—" : warrantPriceFormatter.format(row.lastPrice)}
      </td>
      <td className={`${tableCellClass} text-right font-mono ${changeClass(row.changePct)}`}>
        {formatPct(row.changePct)}
      </td>
      <td className={`${tableCellClass} text-right font-mono text-neutral-300`}>
        {formatVolume(row.volume)}
      </td>
      <td className={`${tableCellClass} text-right font-mono text-neutral-400`}>
        {row.expiry ? formatKlFullDate(row.expiry) : "—"}
      </td>
    </tr>
  );
}

export const WarrantsPanel = memo(WarrantsPanelInner);
