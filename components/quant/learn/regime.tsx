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
      "Large diagonal entries (p₁₁, p₂₂, p₃₃) mean regimes persist — Bull stays Bull.",
      "Off-diagonal mass is how often the climate switches. High p₁₃ is a Bull-to-Volatile jump.",
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
      "State 1 — Bull Regime: μ > 0, σ low (contained volatility).",
      "State 2 — Bear Regime: μ < 0, σ low (contained volatility).",
      "State 3 — Volatile Regime: σ_30d ≥ 1.35 × σ_90d baseline (or σ_ann ≥ 28%).",
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
          30-day drift window plus 30-day vs 90-day realised vol. Short 1–2 day noise flickers are
          absorbed by HMM-style probability persistence so regime colours stay smooth rather than
          flipping every single session.
        </p>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="State 1 — Bull Regime (Green Shading)"
            titleClassName="text-emerald-400"
            measures="Low/contained volatility (σ_ann < 28%) paired with positive 30-day return drift (μ > 0)."
            matters="Strong, steady price momentum. Ideal conditions for trend-following strategies, breakouts, and holding long positions."
          />
          <IndicatorCard
            title="State 2 — Bear Regime (Red Shading)"
            titleClassName="text-rose-400"
            measures="Low/contained volatility (σ_ann < 28%) paired with negative 30-day return drift (μ < 0)."
            matters="Persistent downtrend or price decay. Warns quants to close long positions, activate stop-losses, or pause dip-buying strategies."
          />
          <IndicatorCard
            title="State 3 — Volatile Regime (Yellow Shading)"
            titleClassName="text-amber-400"
            measures="Realized 30-day volatility expands above 1.35× the 90-day baseline (or σ_ann ≥ 28%), regardless of drift direction."
            matters="High market anxiety and unpredictable price swings. Overrides standard trend signals to advise position downsizing and capital preservation."
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
          is contained, <span className="text-rose-400">red Bear</span> when drift is negative and
          vol is still contained, and{" "}
          <span className="text-amber-400">yellow Volatile</span> when 30-day vol clusters above
          1.35× the 90-day baseline or annualised σ reaches 28%. Hover a date to see drift and σ
          together.
        </p>
      </section>

      <aside className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
          Strategic Utility
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
          Use green Bull shades as a green light for trend-following and holding longs. Treat red
          Bear as a cue to close longs, tighten stops, or pause dip-buying. Yellow Volatile
          overrides those trend signals — downsize, preserve capital, and wait for vol to cluster
          back down.
        </p>
      </aside>
    </>
  );
}
