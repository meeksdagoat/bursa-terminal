"use client";

import { buildPolicyRows, type PolicyStance } from "@/lib/global-policy";
import { formatKlDate, formatOpr } from "@/lib/format";
import {
  geBadge,
  geMeta,
  geSectionHeader,
  geSectionShell,
  geSectionSubheader,
} from "@/lib/global-economy-ui";
import type { BnmPayload, CpiSnapshot, PolicyRate } from "@/lib/types";

type GlobalPolicyMatrixProps = {
  rates: PolicyRate[];
  opr: BnmPayload["opr"] | null;
  malaysiaCpi: CpiSnapshot | null;
};

const STANCE_CLASS: Record<PolicyStance, string> = {
  BEARISH: "border-rose-400/40 bg-rose-500/10 text-rose-400",
  BULLISH: "border-emerald-400/40 bg-emerald-500/10 text-emerald-400",
  NEUTRAL: "border-neutral-700 bg-neutral-900 text-neutral-400",
};

export function GlobalPolicyMatrix({ rates, opr, malaysiaCpi }: GlobalPolicyMatrixProps) {
  const rows = buildPolicyRows({ rates, opr, malaysiaCpi });

  return (
    <section className="flex h-auto min-w-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d] lg:h-full lg:min-h-0">
      <header className={geSectionShell}>
        <h3 className={geSectionHeader}>Inflation & Policy Spread</h3>
        <p className={geSectionSubheader}>Real rate = policy − CPI YoY</p>
      </header>

      <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
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
                <td className="min-w-0 px-2 py-1.5">
                  <div className="flex min-w-0 items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-snug text-zinc-200">
                        {row.region}
                      </p>
                      <p className={`${geMeta} uppercase tracking-wider`}>{row.policyLabel}</p>
                    </div>
                    <span className={`${geBadge} font-mono ${STANCE_CLASS[row.stance]}`}>
                      {row.stance}
                    </span>
                  </div>
                  <dl className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
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
    <div className="min-w-0">
      <dt className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </dt>
      <dd
        className={`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] leading-tight tabular-nums ${tone}`}
      >
        {value}
      </dd>
    </div>
  );
}
