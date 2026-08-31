import { IndicatorCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const PAIRS_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "spread-zscore",
    title: "Spread Z-Score",
    latex: [
      "\\text{Spread}_t = P_{A,t} - \\beta \\cdot P_{B,t}",
      "Z_t = \\frac{\\text{Spread}_t - \\mu_{\\text{Spread}}}{\\sigma_{\\text{Spread}}}",
    ],
    parameters: [
      {
        symbol: "β (Hedge Ratio)",
        definition: "OLS linear regression slope: Cov(P_A, P_B) / Var(P_B).",
      },
      {
        symbol: "μ, σ",
        definition: "Rolling 60-day mean and standard deviation of the pair spread (window is selectable in the UI).",
      },
      {
        symbol: "Entry Trigger",
        definition: "Bet on mean-reversion when |Z_t| ≥ 2.0σ.",
      },
      { symbol: "P_A, P_B", definition: "Leg A and Leg B prices (e.g. Maybank vs Public Bank)." },
    ],
    interpretation: [
      "Z ≈ 0 means the spread is where it usually lives. |Z| large means the relationship is stretched.",
      "When Z ≥ +2, Leg A is rich versus Leg B — short A / long B. When Z ≤ −2, reverse it.",
    ],
    note: "Exit when Z returns toward 0. If Z keeps marching to +4, the cointegration thesis may be broken — cut rather than average.",
  },
];

export function LearnPairsContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          The Math &amp; Model
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Pairs trading looks for two co-moving names — classic Bursa example:{" "}
          <span className="font-semibold text-neutral-100">
            Maybank (1155.KL) vs Public Bank (1295.KL)
          </span>
          . The engine estimates a hedge ratio β, builds the residual spread, then standardises it
          as a Z-score against a rolling mean and sigma.
        </p>
        <p className="text-[12px] leading-relaxed text-neutral-400">
          Mean and standard deviation are computed over the selected window (30 / 60 / 90 sessions).
          You are not forecasting which bank wins the decade — you are harvesting the stretch-and-snap
          of a historically tight pair.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Trading Triggers
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Entry (|Z| ≥ 2.0σ)"
            measures="When Z ≥ +2, Leg A is rich versus Leg B. When Z ≤ −2, Leg A is cheap."
            matters="The playbook is mean-reversion: short the outperforming leg, long the underperforming leg. The yellow ±2 lines on the chart are those entry rails."
          />
          <IndicatorCard
            title="Exit (Z → 0)"
            measures="Close when the spread returns toward its rolling mean."
            matters="If Z keeps marching to +4, cointegration may have broken. Size both legs so ringgit notional is comparable — shorting on Bursa is not always frictionless."
          />
        </div>
      </section>

      <aside className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
          Retail Pitfall
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
          Correlation is not a marriage contract. Banks can de-couple on rights issues, results, or
          index rebalances. A pair with r ≈ 0.7 is a candidate; a pair with r ≈ 0 is two unrelated
          stocks wearing a Z-score costume.
        </p>
      </aside>
    </>
  );
}
