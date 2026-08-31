"use client";

import { useMemo, useState } from "react";
import { NUMBER_INPUT, QUANT_CARD, QUANT_PANEL } from "@/components/quant/quant-theme";
import { formatRinggit } from "@/lib/format";
import {
  BURSA_CLEARING_FEE_CAP,
  BURSA_CLEARING_FEE_RATE,
  BURSA_SST_RATE,
  BURSA_STAMP_DUTY_CAP,
  BURSA_STAMP_DUTY_PER_RM1000,
  DEFAULT_BROKERAGE_RATE_PCT,
  DEFAULT_MIN_BROKERAGE,
  calculateBursaFees,
  type TradeSide,
} from "@/lib/calculators/bursa-fees";

const FIELD_LABEL = "font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500";

export function BrokerageFeeCard() {
  const [price, setPrice] = useState(10.5);
  const [shares, setShares] = useState(1_000);
  const [brokerageRatePct, setBrokerageRatePct] = useState(DEFAULT_BROKERAGE_RATE_PCT);
  const [minBrokerage, setMinBrokerage] = useState(DEFAULT_MIN_BROKERAGE);
  const [side, setSide] = useState<TradeSide>("buy");

  const contractValue = Math.max(0, price * shares);
  const fees = useMemo(
    () => calculateBursaFees({ contractValue, brokerageRatePct, minBrokerage }),
    [contractValue, brokerageRatePct, minBrokerage],
  );

  return (
    <section className={`flex flex-col gap-4 ${QUANT_PANEL}`}>
      <div>
        <h2 className="text-[13px] font-semibold text-white">Brokerage Fee & Stamp Duty</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          Indicative Bursa Malaysia contract costs. Stamp duty is RM {BURSA_STAMP_DUTY_PER_RM1000} per
          RM 1,000 (or part thereof), capped at RM {BURSA_STAMP_DUTY_CAP.toLocaleString()}. Clearing
          fee is {(BURSA_CLEARING_FEE_RATE * 100).toFixed(2)}% of contract value (capped RM{" "}
          {BURSA_CLEARING_FEE_CAP.toLocaleString()}). SST is {(BURSA_SST_RATE * 100).toFixed(0)}% on the
          brokerage line. Not a broker quote.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Side</span>
          <div className="inline-flex rounded border border-neutral-800 bg-[#111111] p-0.5">
            {(["buy", "sell"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSide(option)}
                className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase transition-colors ${
                  side === option
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Price (RM)</span>
          <input
            type="number"
            min={0.005}
            step={0.01}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value) || 0)}
            className={NUMBER_INPUT}
          />
        </label>

        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Shares</span>
          <input
            type="number"
            min={1}
            step={100}
            value={shares}
            onChange={(event) => setShares(Math.max(0, Number(event.target.value) || 0))}
            className={NUMBER_INPUT}
          />
        </label>

        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Brokerage %</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={brokerageRatePct}
            onChange={(event) => setBrokerageRatePct(Number(event.target.value) || 0)}
            className={NUMBER_INPUT}
          />
        </label>

        <label className="flex min-w-[8rem] flex-col gap-1">
          <span className={FIELD_LABEL}>Min. brokerage (RM)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={minBrokerage}
            onChange={(event) => setMinBrokerage(Number(event.target.value) || 0)}
            className={NUMBER_INPUT}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Contract value" value={formatRinggit(fees.contractValue)} />
        <Metric title="Brokerage" value={formatRinggit(fees.brokerage)} />
        <Metric title="Stamp duty" value={formatRinggit(fees.stampDuty)} />
        <Metric title="Clearing fee" value={formatRinggit(fees.clearingFee)} />
        <Metric title="SST 8%" value={formatRinggit(fees.sst)} />
        <Metric title="Total fees" value={formatRinggit(fees.totalFees)} tone="text-amber-400" />
        <Metric
          title={side === "buy" ? "Total payable" : "Net proceeds"}
          value={formatRinggit(side === "buy" ? fees.totalPayable : fees.netProceeds)}
          tone="text-emerald-400"
        />
        <Metric title="Effective cost" value={`${fees.effectiveCostPct.toFixed(3)}%`} />
      </div>
    </section>
  );
}

function Metric({ title, value, tone = "text-neutral-100" }: { title: string; value: string; tone?: string }) {
  return (
    <article className={QUANT_CARD}>
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{title}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </article>
  );
}
