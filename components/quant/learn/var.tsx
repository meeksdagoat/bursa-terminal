import { IndicatorCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const VAR_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "parametric-var",
    title: "Parametric VaR",
    latex: [
      "\\text{VaR}_{\\alpha} = \\text{Notional} \\cdot \\left( \\mu \\cdot \\Delta t - Z_{1-\\alpha} \\cdot \\sigma \\sqrt{\\Delta t} \\right)",
    ],
    parameters: [
      { symbol: "Notional", definition: "Total investment capital exposure in MYR." },
      {
        symbol: "Z₁₋α",
        definition: "Standard normal critical value (Z₀.₉₅ = 1.645, Z₀.₉₉ = 2.326).",
      },
      { symbol: "μ", definition: "Expected return over the sample; scaled by horizon Δt." },
      { symbol: "σ", definition: "Return volatility; scaled by √Δt under a random-walk clock." },
      { symbol: "Δt", definition: "Horizon as a fraction of a trading year (1D ≈ 1/252)." },
    ],
    interpretation: [
      "The cutoff is a left-tail loss: drift pulls VaR in, volatility and the z-score push it out.",
      "Parametric VaR is fast and transparent — and wrong when returns are not roughly bell-shaped.",
    ],
  },
  {
    id: "cornish-fisher",
    title: "Cornish–Fisher Expansion (Skew / Kurtosis Correction)",
    latex: [
      "w_{\\alpha} = Z_{\\alpha} + \\frac{S}{6}(Z_{\\alpha}^2 - 1) + \\frac{K}{24}(Z_{\\alpha}^3 - 3Z_{\\alpha}) - \\frac{S^2}{36}(2Z_{\\alpha}^3 - 5Z_{\\alpha})",
    ],
    parameters: [
      { symbol: "S", definition: "Sample skewness of asset returns (asymmetry of the left vs right tail)." },
      { symbol: "K", definition: "Sample excess kurtosis (how fat the tails are versus a normal curve)." },
      { symbol: "wα", definition: "Adjusted critical value that replaces Zα inside parametric VaR." },
    ],
    interpretation: [
      "Negative skew and fat tails increase |wα| — the same 95% label hides a larger true loss.",
      "When S ≈ 0 and K ≈ 0 the expansion collapses back to the ordinary normal z-score.",
    ],
    note: "CVaR (Expected Shortfall) is the mean loss given that you already crossed the VaR line — not a second cutoff.",
  },
];

export function LearnVaRContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          The Math &amp; Model
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Value at Risk answers a single desk question:{" "}
          <span className="font-semibold text-neutral-100">
            “Over the next 1, 10 or 30 trading days, how large a loss should I budget for at 95% or
            99% confidence?”
          </span>{" "}
          This engine runs two industry-standard methods side by side.
        </p>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Parametric (Variance–Covariance)"
            measures="Assumes daily returns are roughly normal. It estimates mean μ and volatility σ, then scales to the horizon with μ × Δt and σ × √Δt."
            matters="Fast and transparent — but wrong when markets are not bell-shaped or when skew/kurtosis are large. Cornish–Fisher is the first correction."
          />
          <IndicatorCard
            title="Historical Simulation"
            measures="No distribution assumed. It ranks the actual overlapping 1-day, 10-day or 30-day returns and reads the 5th or 1st percentile."
            matters="If the past contained a banking sell-off, that loss sits in the sample. If the past was quiet, Historical VaR will look too calm."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Key Metrics Explained
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="95% / 99% VaR"
            measures="A statistical threshold: on 95 (or 99) out of 100 trading days, losses should not exceed this share of notional."
            matters="The remaining 5 (or 1) days are the tail — and those days can still be ugly. VaR is a cutoff, not a crash forecast."
          />
          <IndicatorCard
            title="Conditional VaR (CVaR / Expected Shortfall)"
            measures="The mean loss given that you already crossed the VaR line — the typical size of the red histogram bars to the left of the cutoff."
            matters="If VaR is “don’t lose more than 1.5% most days,” CVaR is “when you do, expect closer to 2.5%.”"
          />
        </div>
      </section>

      <aside className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
          Retail Pitfall
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
          VaR measures normal tail risk inside the sample you fed it. It does not predict black-swan
          crashes, gap-downs on halted names, or liquidity droughts. Treat the number as a budget,
          not a guarantee — and never size a position as if 99% VaR is the worst case imaginable.
        </p>
      </aside>
    </>
  );
}
