"use client";

import { Pulse } from "@/components/skeleton";
import { changeClass, formatPct, formatPrice, formatVolume } from "@/lib/format";
import type { MarketHubDerivative, MarketHubWarrant } from "@/lib/types";

type DerivativesPanelProps = {
  derivatives: MarketHubDerivative[];
  warrants: MarketHubWarrant[];
  filter: string;
  loading?: boolean;
};

function formatPts(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value).toFixed(1);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function DerivativeSkeleton() {
  return (
    <article className="border border-neutral-800 bg-[#0d0d0d] px-3 py-3" aria-hidden>
      <Pulse className="h-3 w-40" />
      <Pulse className="mt-2 h-2.5 w-28" />
      <Pulse className="mt-4 h-7 w-32" />
      <div className="mt-3 flex gap-3">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-3 w-16" />
      </div>
    </article>
  );
}

export function DerivativesPanel({
  derivatives,
  warrants,
  filter,
  loading,
}: DerivativesPanelProps) {
  const needle = filter.trim().toLowerCase();
  const visibleWarrants = needle
    ? warrants.filter(
        (row) =>
          row.code.toLowerCase().includes(needle) ||
          row.name?.toLowerCase().includes(needle) ||
          row.underlying.toLowerCase().includes(needle) ||
          row.type.toLowerCase().includes(needle),
      )
    : warrants;

  const fcpo = derivatives.find((row) => row.id === "fcpo");
  const fkli = derivatives.find((row) => row.id === "fkli");
  const cards = [fcpo, fkli].filter((row): row is MarketHubDerivative => row != null);

  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Derivatives &amp; Commodities
        </h2>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          BMD FCPO / FKLI · top active structured warrants
        </p>
      </header>

      <div className="grid gap-2 lg:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }, (_, index) => <DerivativeSkeleton key={index} />)
          : cards.map((row) => (
              <article key={row.id} className="border border-neutral-800 bg-[#0d0d0d] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[12px] font-semibold text-neutral-100">{row.label}</h3>
                    <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{row.contract}</p>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                    {row.fallback ? "Snapshot" : row.source}
                  </span>
                </div>
                <p className="mt-3 font-mono text-[20px] tabular-nums text-white">
                  {formatPrice(row.price)}
                  <span className="ml-2 text-[11px] text-neutral-500">{row.unit}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                  <span className={changeClass(row.changePts ?? row.changePct1d)}>
                    {formatPts(row.changePts)} pts
                  </span>
                  <span className={changeClass(row.changePct1d)}>
                    1D {formatPct(row.changePct1d)}
                  </span>
                  {row.volume != null ? (
                    <span className="text-neutral-400">Vol {formatVolume(row.volume)}</span>
                  ) : null}
                  {row.premiumPct != null ? (
                    <span className={changeClass(row.premiumPct)}>
                      vs cash {formatPct(row.premiumPct)}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
      </div>

      <div className="overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
        <div className="border-b border-neutral-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Structured warrants · top active
        </div>
        {loading ? (
          <div className="space-y-2 px-3 py-3" aria-busy="true" aria-label="Loading warrants">
            {Array.from({ length: 6 }, (_, index) => (
              <Pulse key={index} className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-neutral-800 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Underlier</th>
                  <th className="px-3 py-2 text-right">Last</th>
                  <th className="px-3 py-2 text-right">1D %</th>
                  <th className="px-3 py-2 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {visibleWarrants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center font-mono text-[10px] text-neutral-600"
                    >
                      No warrants match
                    </td>
                  </tr>
                ) : (
                  visibleWarrants.map((row) => (
                    <tr key={row.symbol} className="border-b border-neutral-900 hover:bg-[#121212]">
                      <td className="px-3 py-2 font-mono text-[12px] text-gain">{row.code}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-[12px] text-neutral-200">
                        {row.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`font-mono text-[10px] uppercase tracking-wider ${
                            row.type === "Call" ? "text-gain" : "text-loss"
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-neutral-400">
                        {row.underlying}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-neutral-100">
                        {formatPrice(row.lastPrice)}
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
