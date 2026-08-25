"use client";

import { buildPolicyRows, type PolicyStance } from "@/lib/global-policy";
import { formatKlDate, formatOpr } from "@/lib/format";
import type { BnmPayload, CpiSnapshot, PolicyRate } from "@/lib/types";

type GlobalPolicyMatrixProps = {
  rates: PolicyRate[];
  opr: BnmPayload["opr"] | null;
  malaysiaCpi: CpiSnapshot | null;
};

const STANCE_CLASS: Record<PolicyStance, string> = {
  HAWKISH: "border-rose-400/40 bg-rose-500/10 text-rose-400",
  DOVISH: "border-emerald-400/40 bg-emerald-500/10 text-emerald-400",
  NEUTRAL: "border-neutral-700 bg-neutral-900 text-neutral-400",
};

export function GlobalPolicyMatrix({ rates, opr, malaysiaCpi }: GlobalPolicyMatrixProps) {
  const rows = buildPolicyRows({ rates, opr, malaysiaCpi });

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
      <header className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Inflation & Policy Spread
        </h3>
        <p className="mt-0.5 text-[10px] text-neutral-500">Real rate = policy − CPI YoY</p>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-800 font-mono text-[8px] uppercase tracking-[0.14em] text-neutral-600">
              <th className="px-3 py-1.5 font-medium">Region</th>
              <th className="px-2 py-1.5 font-medium">Policy</th>
              <th className="px-2 py-1.5 font-medium">CPI YoY</th>
              <th className="px-2 py-1.5 font-medium">Real</th>
              <th className="px-2 py-1.5 font-medium">Next</th>
              <th className="px-3 py-1.5 font-medium">Stance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-800 last:border-b-0">
                <td className="px-3 py-2">
                  <p className="text-[11px] text-neutral-200">{row.region}</p>
                  <p className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">
                    {row.policyLabel}
                  </p>
                </td>
                <td className="px-2 py-2 font-mono text-[12px] text-neutral-100">
                  {formatOpr(row.policyRate)}
                </td>
                <td className="px-2 py-2 font-mono text-[12px] text-neutral-300">
                  {formatOpr(row.cpiYoy)}
                </td>
                <td
                  className={`px-2 py-2 font-mono text-[12px] ${
                    (row.realRate ?? 0) > 0
                      ? "text-emerald-400"
                      : (row.realRate ?? 0) < 0
                        ? "text-rose-400"
                        : "text-neutral-400"
                  }`}
                >
                  {row.realRate == null
                    ? "—"
                    : `${row.realRate > 0 ? "+" : ""}${row.realRate.toFixed(2)}%`}
                </td>
                <td className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  {formatKlDate(row.nextDecision)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[8px] tracking-wider ${STANCE_CLASS[row.stance]}`}
                  >
                    {row.stance}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
