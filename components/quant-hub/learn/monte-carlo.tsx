import { IndicatorCard, StepCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const MONTE_CARLO_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "monte-carlo-gbm",
    title: "Geometric Brownian Motion (GBM)",
    latex: [
      "S_{t+\\Delta t} = S_t \\cdot \\exp\\left( \\left(\\mu - \\frac{1}{2}\\sigma^2\\right)\\Delta t + \\sigma \\sqrt{\\Delta t} \\, Z \\right)",
    ],
    parameters: [
      { symbol: "S_t", definition: "Current stock price at step t." },
      { symbol: "μ", definition: "Daily drift — annualized as trend bias in the UI." },
      { symbol: "σ", definition: "Daily volatility — annualized as price swing range." },
      { symbol: "Δt", definition: "Time step — fraction of trading year (1 / 252)." },
      { symbol: "Z ~ N(0,1)", definition: "Random shock drawn from a normal distribution." },
    ],
    interpretation: [
      "Each run rolls the price forward one day at a time, adding random noise around the trend.",
      "Running 1,000+ paths builds a probability cloud instead of a single guess.",
    ],
  },
  {
    id: "box-muller",
    title: "Box-Muller Transform (Gaussian Random Draws)",
    latex: [
      "Z_0 = \\sqrt{-2 \\ln U_1} \\cdot \\cos(2\\pi U_2)",
      "Z_1 = \\sqrt{-2 \\ln U_1} \\cdot \\sin(2\\pi U_2)",
    ],
    parameters: [
      { symbol: "U₁, U₂", definition: "Independent uniform random numbers between 0 and 1." },
      { symbol: "Z₀, Z₁", definition: "Two independent standard normal samples from one draw pair." },
    ],
    note: "Converts uniform randomness into bell-curve shocks (Z) used inside the GBM step formula.",
  },
];

export function LearnMonteCarloContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          What Is Monte Carlo Simulation?
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Instead of guessing where a stock might land in 30 days or 1 year, this tool runs{" "}
          <span className="font-semibold text-amber-400">thousands of random future price trials</span>{" "}
          based on how the stock actually behaved in the past. Each trial follows{" "}
          <span className="font-semibold text-neutral-200">Geometric Brownian Motion</span> — a
          standard way to model prices that trend up or down (drift) while bouncing around (volatility).
          The result is a probability map, not a crystal ball.
        </p>
        <aside className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
            Plain English Takeaway
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
            If history says a stock drifts +6%/year but swings ±15%/year, Monte Carlo asks:{" "}
            <em>&ldquo;Given that pattern, what are 1,000 plausible endings?&rdquo;</em> You get
            average outcomes, worst-case floors, and win odds — replacing gut feel with stats.
          </p>
        </aside>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Parameters Explained
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Daily Drift (μ / Mean) — e.g. +6.20%/yr"
            measures="The long-run direction or trend bias of the asset, annualized from historical daily returns."
            matters="Positive drift means the model tilts paths upward on average; negative drift tilts them down. It is not a guarantee — just the historical tendency."
          />
          <IndicatorCard
            title="Daily Volatility (σ / Variance) — e.g. ±14.71%/yr"
            measures="How widely prices swing around that trend, annualized."
            matters="Higher σ = wider fan of outcomes = more risk. Low-volatility stocks cluster tightly; high-volatility names spread into extreme scenarios."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Key Metrics on Screen
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Expected Final Price (S_T)"
            measures="The theoretical average ending price across all simulated paths."
            matters="Think of it as the 'middle of the pack' outcome. Half the runs finish above, half below — but extreme paths pull this number."
          />
          <IndicatorCard
            title="95% Value-at-Risk (VaR)"
            measures="The 5th percentile worst-case loss over your chosen horizon — only 5% of runs did worse."
            matters="If VaR is −18%, that means in the bottom 5% of scenarios you could lose ~18% or more. Use it to size positions and set stop-loss buffers."
          />
          <IndicatorCard
            title="Profit Probability (%)"
            measures="Percentage of runs that finish above today's entry price."
            matters="70% profit probability ≠ guaranteed win — it means 7 out of 10 simulated paths ended green. Pair with VaR for a full risk picture."
          />
          <IndicatorCard
            title="Statistical Run Stabilization"
            measures="Why numbers shift slightly when you refresh, and why 5,000 / 10,000 runs look smoother than 250."
            matters="Each refresh draws new random paths (Law of Large Numbers). More runs = smoother distribution curves and stabler VaR/probability estimates — at the cost of compute time."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          How to Use This Tab in 3 Easy Steps
        </h3>
        <ol className="flex flex-col gap-2">
          <StepCard
            step={1}
            title="Pick Horizon & Runs"
            body="Start with 30D or 1Y horizon and 1,000 runs. Increase to 5,000+ when you need smoother VaR readings for serious sizing."
          />
          <StepCard
            step={2}
            title="Read VaR Before Expected Price"
            body="Check the worst-case 5% floor first. If VaR exceeds your risk budget, reduce position size even if expected price looks attractive."
          />
          <StepCard
            step={3}
            title="Compare Profit Probability vs Drift"
            body="High profit probability with modest drift confirms a favourable skew. Low probability with high drift warns the upside is fighting heavy volatility."
          />
        </ol>
      </section>
    </>
  );
}
