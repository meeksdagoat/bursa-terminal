"use client";

import { changeClass, formatPct } from "@/lib/format";
import type { UnitTrustFund } from "@/lib/unit-trust/types";

type UnitTrustTableProps = {
  funds: UnitTrustFund[];
  selectedFund: UnitTrustFund | null;
  onSelectFund: (fund: UnitTrustFund) => void;
};

function formatNav(fund: UnitTrustFund): string {
  if (fund.priceType === "Fixed") return `RM ${fund.currentNav.toFixed(2)} (fixed)`;
  return `RM ${fund.currentNav.toFixed(4)}`;
}

function formatSen(sen: number | null): string {
  if (sen == null) return "—";
  return `${sen.toFixed(2)} sen`;
}

export function UnitTrustTable({ funds, selectedFund, onSelectFund }: UnitTrustTableProps) {
  return (
    <section className="min-w-0 border border-line bg-[#121212]">
      <div className="border-b border-line px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Performance table
        </h2>
        <p className="mt-0.5 font-mono text-[9px] text-neutral-600">Click any row to view historical analytics</p>
      </div>

      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-800 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              <th className="px-3 py-2">Fund name</th>
              <th className="px-3 py-2">Management co.</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Latest NAV/unit</th>
              <th className="px-3 py-2 text-right">1Y return</th>
              <th className="px-3 py-2 text-right">Dividend payout</th>
              <th className="px-3 py-2 text-center">Shariah</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {funds.map((fund) => {
              const selected = fund.id === selectedFund?.id;
              return (
                <tr
                  key={fund.id}
                  onClick={() => onSelectFund(fund)}
                  className={`cursor-pointer border-l-2 transition-colors hover:bg-neutral-800/60 ${
                    selected
                      ? "border-l-purple-500 bg-purple-950/40"
                      : "border-l-transparent bg-transparent"
                  }`}
                >
                  <td className="px-3 py-2">
                    <p className="text-[12px] font-medium text-neutral-100">{fund.shortName}</p>
                    <p className="mt-0.5 max-w-[220px] truncate font-mono text-[9px] text-neutral-600">
                      {fund.name}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-neutral-400">{fund.provider}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                        fund.priceType === "Fixed"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border-sky-500/30 bg-sky-500/10 text-sky-300"
                      }`}
                    >
                      {fund.priceType}
                    </span>
                    <p className="mt-0.5 font-mono text-[9px] text-neutral-600">{fund.category}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-neutral-100">
                    {formatNav(fund)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-[11px] tabular-nums ${changeClass(fund.return1yPct)}`}>
                    {formatPct(fund.return1yPct)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[10px] tabular-nums text-neutral-300">
                    {formatSen(fund.distributionSen)}
                    {fund.dividendYieldPct != null ? (
                      <span className="mt-0.5 block text-[9px] text-neutral-600">
                        {formatPct(fund.dividendYieldPct)} yield
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fund.shariah ? (
                      <span className="border border-gain/30 bg-gain/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-gain">
                        Shariah
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-neutral-600">Conventional</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectFund(fund);
                      }}
                      className={`min-h-8 border px-2.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                        selected
                          ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                          : "border-neutral-800 text-neutral-400 hover:border-violet-500/40 hover:text-violet-300"
                      }`}
                    >
                      View analytics
                    </button>
                  </td>
                </tr>
              );
            })}
            {funds.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center font-mono text-[10px] text-neutral-600">
                  NO FUNDS MATCH THIS FILTER
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
