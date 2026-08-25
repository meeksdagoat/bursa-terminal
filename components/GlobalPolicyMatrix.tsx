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
    <section className="flex h-full min-h-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
      <header className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Inflation & Policy Spread
        </h3>
        <p className="mt-0.5 text-[10px] text-neutral-500">Real rate = policy − CPI YoY</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sr-only">
            <tr>
              <th>Region</th>
              <th>Policy Rate</th>
              <th>Latest CPI (YoY %)</th>
              <th>Real Interest Rate</th>
              <th>Next Rate Decision Date</th>
              <th>Stance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-800 last:border-b-0">
                <td className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-neutral-200">{row.region}</p>
                      <p className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">
                        {row.policyLabel}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[8px] tracking-wider ${STANCE_CLASS[row.stance]}`}
                    >
                      {row.stance}
                    </span>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-4 gap-1">
                    <Metric label="Policy" value={formatOpr(row.policyRate)} />
                    <Metric label="CPI YoY" value={formatOpr(row.cpiYoy)} />
                    <Metric
                      label="Real"
                      value={
                        row.realRate == null
                          ? "—"
                          : `${row.realRate > 0 ? "+" : ""}${row.realRate.toFixed(2)}%`
                      }
                      tone={
                        (row.realRate ?? 0) > 0
                          ? "text-emerald-400"
                          : (row.realRate ?? 0) < 0
                            ? "text-rose-400"
                            : "text-neutral-400"
                      }
                    />
                    <Metric label="Next" value={formatKlDate(row.nextDecision)} />
                  </dl>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "text-neutral-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[7px] uppercase tracking-[0.14em] text-neutral-600">{label}</dt>
      <dd className={`font-mono text-[11px] leading-tight ${tone}`}>{value}</dd>
    </div>
  );
}
