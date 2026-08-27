"use client";

import { Pulse } from "@/components/skeleton";
import { changeClass, formatPct, formatPrice } from "@/lib/format";
import type { MarketHubBenchmark, MarketHubSectorRow } from "@/lib/types";

type IndicesGridProps = {
  benchmarks: MarketHubBenchmark[];
  sectors: MarketHubSectorRow[];
  filter: string;
  loading?: boolean;
};

function StatusBadge({ status }: { status: MarketHubSectorRow["status"] }) {
  const label = status === "open" ? "OPEN" : status === "delayed" ? "DELAYED" : "CLOSED";
  const tone =
    status === "open"
      ? "text-gain border-gain/30 bg-gain/10"
      : "text-neutral-500 border-neutral-800 bg-[#0a0a0a]";
  return (
    <span
      className={`rounded-sm border px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}

function BenchmarkSkeleton() {
  return (
    <article className="border border-neutral-800 bg-[#0d0d0d] px-3 py-3" aria-hidden>
      <Pulse className="h-3 w-24" />
      <Pulse className="mt-3 h-6 w-28" />
      <div className="mt-3 flex gap-3">
        <Pulse className="h-3 w-16" />
        <Pulse className="h-3 w-16" />
      </div>
    </article>
  );
}

export function IndicesGrid({ benchmarks, sectors, filter, loading }: IndicesGridProps) {
  const needle = filter.trim().toLowerCase();
  const visibleSectors = needle
    ? sectors.filter((row) => row.label.toLowerCase().includes(needle))
    : sectors;

  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Benchmarks &amp; Sectors
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            FBM KLCI · Mid 70 · Small Cap · EMAS Shariah · 13 ICB industries
          </p>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, index) => <BenchmarkSkeleton key={index} />)
          : benchmarks.map((row) => (
              <article key={row.id} className="border border-neutral-800 bg-[#0d0d0d] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[12px] font-semibold text-neutral-100">{row.label}</h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                    {row.fallback ? "Snapshot" : row.symbol ?? "—"}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[18px] tabular-nums text-white">
                  {formatPrice(row.price)}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                  <span className={changeClass(row.changePct1d)}>1D {formatPct(row.changePct1d)}</span>
                  <span className={changeClass(row.changePctYtd)}>
                    YTD {formatPct(row.changePctYtd)}
                  </span>
                </div>
              </article>
            ))}
      </div>

      <div className="overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
        {loading ? (
          <div className="space-y-2 px-3 py-3" aria-busy="true" aria-label="Loading sectors">
            {Array.from({ length: 8 }, (_, index) => (
              <Pulse key={index} className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-neutral-800 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-3 py-2">ICB Sector</th>
                  <th className="px-3 py-2 text-right">1D %</th>
                  <th className="px-3 py-2 text-right">YTD %</th>
                  <th className="px-3 py-2 text-right">Names</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleSectors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center font-mono text-[10px] text-neutral-600"
                    >
                      No sectors match “{filter}”
                    </td>
                  </tr>
                ) : (
                  visibleSectors.map((row) => (
                    <tr key={row.label} className="border-b border-neutral-900 hover:bg-[#121212]">
                      <td className="px-3 py-2 text-[12px] text-neutral-100">{row.label}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-[12px] ${changeClass(row.changePct1d)}`}
                      >
                        {formatPct(row.changePct1d)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono text-[12px] ${changeClass(row.changePctYtd)}`}
                      >
                        {formatPct(row.changePctYtd)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-neutral-400">
                        {row.count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
