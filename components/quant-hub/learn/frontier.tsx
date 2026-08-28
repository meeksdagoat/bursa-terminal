import { IndicatorCard, StepCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const FRONTIER_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "portfolio-variance",
    title: "Portfolio Variance",
    latex: ["\\sigma_p^2 = \\mathbf{w}^T \\Sigma \\mathbf{w}"],
    parameters: [
      { symbol: "w", definition: "Vector of asset weights (must sum to 100%)." },
      { symbol: "Σ", definition: "Covariance matrix — how each pair of assets moves together." },
      { symbol: "σ_p²", definition: "Total portfolio variance (risk squared)." },
    ],
    interpretation: [
      "Combining assets that don't move in lockstep lowers σ_p² — diversification benefit.",
      "The efficient frontier plots every (risk, return) pair achievable by some weight mix.",
    ],
  },
  {
    id: "covariance-matrix",
    title: "Covariance Matrix",
    latex: [
      "\\Sigma_{ij} = \\text{Cov}(R_i, R_j) = E[(R_i - \\mu_i)(R_j - \\mu_j)]",
    ],
    parameters: [
      { symbol: "R_i, R_j", definition: "Daily (or periodic) returns of assets i and j." },
      { symbol: "μ_i, μ_j", definition: "Mean returns of assets i and j." },
      { symbol: "Σ_ij", definition: "Off-diagonal = co-movement; diagonal = each asset's own variance." },
    ],
    note: "Negative covariance between two assets helps reduce overall portfolio swings when blended.",
  },
  {
    id: "sharpe-ratio",
    title: "Sharpe Ratio (Max Sharpe Portfolio)",
    latex: [
      "\\text{Sharpe} = \\frac{R_p - R_f}{\\sigma_p}",
    ],
    parameters: [
      { symbol: "R_p", definition: "Expected portfolio return." },
      { symbol: "R_f", definition: "Risk-free rate (proxy in engine)." },
      { symbol: "σ_p", definition: "Portfolio volatility (standard deviation)." },
    ],
    note: "Max Sharpe = best return per unit of risk — the green dot on the chart.",
  },
];

export function LearnFrontierContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          What Is the Efficient Frontier?
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Modern Portfolio Theory (MPT) answers a simple question:{" "}
          <span className="font-semibold text-neutral-200">
            &ldquo;How do I mix several stocks to get the most return for the least risk?&rdquo;
          </span>{" "}
          This tab simulates thousands of random weight combinations, plots them as a cloud of dots,
          and highlights the mathematically best portfolios — so you do not have to guess allocation
          percentages by gut feel.
        </p>
        <aside className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
            Plain English Takeaway
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
            Putting all your money in one hot stock is high risk. Blending uncorrelated names (bank +
            plantation + tech) can smooth the ride. The frontier shows the smartest blends for your
            risk appetite.
          </p>
        </aside>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Reading the Chart
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Cloud of Dots (Simulated Portfolios)"
            measures="Each dot is one random weight allocation across your selected symbols — thousands of 'what if' mixes."
            matters="The outer edge of the cloud is the efficient frontier: no other mix gives more return for that level of risk."
          />
          <IndicatorCard
            title="Minimum Variance Portfolio (Blue Dot)"
            measures="The mathematically safest blend — lowest volatility in the simulation set."
            matters="Choose this if capital preservation matters most. Returns may be modest, but swings are minimized."
          />
          <IndicatorCard
            title="Max Sharpe Portfolio (Green Dot)"
            measures='The best "value for money" mix — highest risk-adjusted return (return per unit of risk).'
            matters="Often the sweet spot for long-term investors who want growth without reckless volatility."
          />
          <IndicatorCard
            title="Risk Tolerance Slider (Conservative → Aggressive)"
            measures="Slides your custom portfolio along the frontier between safety and return."
            matters="Conservative tilts toward low-vol names and higher weights on stable sectors. Aggressive chases higher expected return at the cost of wider drawdowns."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Allocation Cards Below the Chart
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          After picking a risk level, the weight cards show exactly how much to put in each ticker
          (e.g. 32% Maybank, 18% Petronas Dagangan). Use presets (Bank Heavy, Dividend, Shariah) as
          starting points, then add/remove symbols with the search bar to match your universe.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          How to Use This Tab in 3 Easy Steps
        </h3>
        <ol className="flex flex-col gap-2">
          <StepCard
            step={1}
            title="Build Your Universe"
            body="Select 3–10 symbols you actually want to hold. Mix sectors so they don't all move together."
          />
          <StepCard
            step={2}
            title="Find Blue & Green Dots"
            body="Compare Min Variance (blue) vs Max Sharpe (green). Blue = sleep-at-night portfolio; green = best risk/reward trade-off."
          />
          <StepCard
            step={3}
            title="Slide Risk Tolerance"
            body="Move the slider until the allocation cards match your comfort level, then use those weights as a rebalancing guide — not a one-time bet."
          />
        </ol>
      </section>
    </>
  );
}
