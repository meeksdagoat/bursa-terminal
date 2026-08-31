import { IndicatorCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const REGIME_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "transition-matrix",
    title: "State Transition Probability Matrix (P)",
    latex: [
      "P = \\begin{pmatrix} p_{11} & p_{12} & p_{13} \\\\ p_{21} & p_{22} & p_{23} \\\\ p_{31} & p_{32} & p_{33} \\end{pmatrix}, \\quad \\text{where } p_{ij} = \\mathbb{P}(S_{t+1} = j \\mid S_t = i)",
    ],
    parameters: [
      { symbol: "Sₜ", definition: "Hidden regime at time t (unobserved “weather” of the market)." },
      { symbol: "pᵢⱼ", definition: "Probability of moving from regime i today to regime j tomorrow." },
      {
        symbol: "Rows of P",
        definition: "Each row sums to 1 — you always land in some regime next period.",
      },
    ],
    interpretation: [
      "Large diagonal entries (p₁₁, p₂₂, p₃₃) mean regimes persist — bull stays bull.",
      "Off-diagonal mass is how often the climate switches. High p₁₃ is a bull-to-bear crash jump.",
    ],
  },
  {
    id: "gaussian-emission",
    title: "Gaussian Emission Likelihood",
    latex: [
      "f(y_t \\mid S_t = k) = \\frac{1}{\\sqrt{2\\pi \\sigma_k^2}} \\exp\\left( -\\frac{(y_t - \\mu_k)^2}{2\\sigma_k^2} \\right)",
    ],
    parameters: [
      { symbol: "yₜ", definition: "Observed return (or drift/vol feature) on day t." },
      { symbol: "μₖ, σₖ", definition: "Mean and volatility of returns while the chain is in state k." },
    ],
    interpretation: [
      "State 1 — Bullish trend: μ₁ > 0, σ₁ low.",
      "State 2 — Sideways noise: μ₂ ≈ 0, σ₂ low.",
      "State 3 — Volatile bear: μ₃ < 0, σ₃ high.",
    ],
    note: "The classifier infers which Gaussian is most likely generating today’s tape, then colours the chart. It does not pick your ticker — it tells you which playbook is less likely to be fighting the weather.",
  },
];

export function LearnRegimeContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          The Math &amp; Model
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          A Hidden Markov Model treats the true market state as unobservable (“hidden”) and infers
          it from what you can see: rolling return drift and volatility clustering. This tab uses a
          30-day drift window plus 30-day vs 90-day realised vol, then smooths short flickers so
          regimes persist like HMM states rather than flipping every session.
        </p>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="State 1 — Bullish Trend"
            measures="Positive drift, contained volatility (μ₁ > 0, σ₁ low)."
            matters="Trend-following, breakouts, and adding to winners are statistically more at home here."
          />
          <IndicatorCard
            title="State 2 — Sideways Noise"
            measures="Near-zero drift, low volatility (μ₂ ≈ 0, σ₂ low)."
            matters="Fade-the-extremes and pairs mean-reversion often beat chasing breakouts. Easy to over-trade."
          />
          <IndicatorCard
            title="State 3 — Volatile Bear"
            measures="Negative drift, expanded ranges (μ₃ < 0, σ₃ high)."
            matters="Capital preservation, smaller size, and waiting for vol to cluster back down usually beat heroics."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          How to read this tab
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-400">
          The shaded price chart maps those climates onto three colours:{" "}
          <span className="text-emerald-400">green Bull</span> when 30-day drift is positive and vol
          is contained, <span className="text-rose-400">rose Bear</span> when drift is negative, and{" "}
          <span className="text-amber-400">amber Volatile</span> when 30-day vol clusters above the
          90-day baseline. Hover a date to see drift and σ together.
        </p>
      </section>

      <aside className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
          Strategic Utility
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
          Use Bull shades as a green light for trend-following and DCA add-ons. Treat amber Volatile
          as a cue to cut leverage, widen stops, or stand aside. Bear / high-vol regimes favour
          raising cash or tightly defined mean-reversion — not a one-strategy-fits-all tape.
        </p>
      </aside>
    </>
  );
}
