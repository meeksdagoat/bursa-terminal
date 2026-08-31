import { IndicatorCard, StepCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const DCA_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "average-cost-basis",
    title: "Average Cost Basis",
    latex: [
      "\\text{Average Cost Basis} = \\frac{\\text{Total Capital Invested}}{\\text{Total Accumulated Units}}",
    ],
    parameters: [
      { symbol: "Total Capital Invested", definition: "Sum of every fixed contribution over the DCA schedule." },
      { symbol: "Total Accumulated Units", definition: "Shares or fund units purchased across all intervals." },
    ],
    interpretation: [
      "When prices fall, the same RM amount buys more units — pulling your average cost below the latest market price.",
      "Compare average cost basis to the current unit price to gauge unrealised gain or loss.",
    ],
  },
  {
    id: "portfolio-value",
    title: "DCA Portfolio Value",
    latex: ["\\text{Portfolio Value}_t = \\text{Total Units}_t \\times \\text{Unit Price}_t"],
    parameters: [
      { symbol: "Total Units_t", definition: "Cumulative units held after all contributions through date t." },
      { symbol: "Unit Price_t", definition: "Market price (NAV or close) on date t." },
    ],
    note: "The orange curve in this simulator plots Portfolio Value_t against the grey cumulative-invested line.",
  },
  {
    id: "total-return",
    title: "Total Return on DCA",
    latex: [
      "\\text{Total Return \\%} = \\frac{\\text{Portfolio Value} - \\text{Capital Invested}}{\\text{Capital Invested}} \\times 100",
    ],
    note: "Positive return means your accumulated units are worth more than the cash you put in — before fees and taxes.",
  },
];

export function LearnDCAContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          What Is Dollar-Cost Averaging (DCA)?
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Dollar-Cost Averaging means investing a{" "}
          <span className="font-semibold text-neutral-200">fixed amount of money on a regular schedule</span>{" "}
          — weekly, monthly, etc. — regardless of whether the market is up or down. You buy more units when
          prices are low and fewer when prices are high, which smooths out the average price you pay over
          time.
        </p>
        <aside className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
            Plain English Takeaway
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
            DCA is the opposite of trying to time the perfect entry. You commit to a rhythm (e.g. RM 500
            every month into a unit trust or stock) and let consistency do the heavy lifting.
          </p>
        </aside>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          DCA vs. Lump-Sum Investing
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Dollar-Cost Averaging"
            measures="Spreads the same total capital across many purchase dates at fixed intervals."
            matters="Lowers emotional stress and timing risk during downturns — you keep buying through dips instead of freezing. Historically sacrifices some upside when markets rise steadily from day one."
          />
          <IndicatorCard
            title="Lump-Sum (All-In Today)"
            measures="Deploys the full amount immediately at the current market price."
            matters="Historically outperforms DCA in long bull markets because more capital compounds sooner. But a poorly timed lump sum before a crash can take years to recover psychologically and financially."
          />
        </div>
        <p className="text-[11px] leading-relaxed text-neutral-500">
          Neither approach guarantees profits. DCA suits investors who earn income over time (salary +
          EPF top-ups) and want a disciplined, lower-stress path.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          How Average Cost Basis Works
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Each contribution buys units at that day&apos;s price. Your{" "}
          <span className="font-semibold text-neutral-200">average cost basis</span> is the blended price
          you paid per unit across all purchases:
        </p>
        <div className="rounded-lg border border-neutral-800 bg-[#0d0d0d] px-3 py-2.5 font-mono text-[11px] text-neutral-300">
          Average Cost Basis = Total Capital Invested ÷ Total Accumulated Units
        </div>
        <ol className="flex flex-col gap-2">
          <StepCard
            step={1}
            title="Month 1 — Price RM 10"
            body="Invest RM 500 → buy 50 units. Average cost = RM 10.00/unit."
          />
          <StepCard
            step={2}
            title="Month 2 — Price drops to RM 8"
            body="Invest RM 500 → buy 62.5 units. Total 112.5 units for RM 1,000 → average cost ≈ RM 8.89/unit (lower than RM 10)."
          />
          <StepCard
            step={3}
            title="Month 3 — Price recovers to RM 12"
            body="Invest RM 500 → buy 41.67 units. If price stays at RM 12, your 154.17 units are worth RM 1,850 on RM 1,500 invested — unrealised gain because you accumulated cheap units in month 2."
          />
        </ol>
        <p className="text-[11px] text-neutral-500">
          This simulator computes the same logic on real historical prices for your chosen asset and
          frequency.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Key Strategic Tips
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Automate to Remove Bias"
            measures="Standing instructions (auto-debit, PRS/UT regular savings) enforce the schedule."
            matters="The biggest DCA advantage is behavioural — you avoid skipping buys when headlines turn scary."
          />
          <IndicatorCard
            title="Weekly vs. Monthly Frequency"
            measures="More frequent buys smooth entry prices further but multiply transaction events."
            matters="Monthly DCA is the sweet spot for most Malaysian unit trusts and brokerage accounts. Weekly can help volatile names but watch minimum fees."
          />
          <IndicatorCard
            title="Watch Platform & Sales Charges"
            measures="UT sales charges, brokerage min commissions, and FX spreads eat small contributions."
            matters="A RM 100 weekly buy with a high front-end load may underperform a RM 400 monthly buy with the same annual total. Model net amounts in this tab using realistic contribution sizes."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Reading This Simulator
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Grey Step Line — Cash Invested"
            measures="Cumulative contributions only; ignores market moves."
            matters="Shows how much capital you committed — your cost base before returns."
          />
          <IndicatorCard
            title="Orange Line — Portfolio Value"
            measures="Total units × current price on each historical date."
            matters="When orange is above grey, DCA has grown your money. The gap is total profit before fees."
          />
        </div>
      </section>
    </>
  );
}
