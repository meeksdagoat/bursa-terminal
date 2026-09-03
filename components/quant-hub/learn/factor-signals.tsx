import {
  IndicatorCard,
  SCORE_SCALE,
  StepCard,
  type AdvancedFormulaSection,
} from "@/components/quant-hub/learn-quant-shared";

export const FACTOR_SIGNALS_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "score-standardization",
    title: "Score Standardization (−100 to +100)",
    latex: [
      "Z = \\frac{x - \\mu}{\\sigma}",
      "\\text{Score} = \\text{clamp}\\left( \\frac{x - \\mu}{\\sigma} \\times 33.3, \\,-100, \\,+100 \\right)",
    ],
    parameters: [
      { symbol: "x", definition: "Raw alternative data input (e.g. rainfall mm, news count)." },
      { symbol: "μ", definition: "90-day baseline average — what “normal” looks like." },
      { symbol: "σ", definition: "90-day spread — how much the input usually wobbles." },
      {
        symbol: "33.3",
        definition: "Scaling factor mapping ±3σ events across the full [−100, +100] gauge.",
      },
    ],
    interpretation: [
      "Score > +50: Signal is more than +1.5σ above historical normal — unusually bullish.",
      "Score < −50: Signal is more than −1.5σ below historical normal — unusually bearish.",
    ],
  },
  {
    id: "pearson-r",
    title: "Pearson Correlation Coefficient (R)",
    latex: [
      "r = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum (x_i - \\bar{x})^2 \\sum (y_i - \\bar{y})^2}}",
    ],
    parameters: [
      { symbol: "x_i, y_i", definition: "Individual data points for metric and stock returns." },
      { symbol: "x̄, ȳ", definition: "Sample means over the active rolling window." },
    ],
    note: "Measures how closely two numbers move together. +1 = same direction, −1 = opposite, 0 = no link.",
  },
  {
    id: "weather-agri",
    title: "Weather & Agri Anomaly Score (WAS)",
    latex: [
      "\\text{WAS} = w_1 \\cdot \\left( \\frac{\\text{Rain}_{30\\text{d}} - \\mu_{\\text{Rain}}}{\\sigma_{\\text{Rain}}} \\right) + w_2 \\cdot \\left( \\frac{\\text{Temp}_{30\\text{d}} - \\mu_{\\text{Temp}}}{\\sigma_{\\text{Temp}}} \\right)",
    ],
    parameters: [
      { symbol: "Rain₃₀d", definition: "Cumulative 30-day precipitation (mm)." },
      { symbol: "Temp₃₀d", definition: "Mean 30-day temperature (°C)." },
      { symbol: "w₁, w₂", definition: "Crop impact weights (0.7 rainfall / 0.3 temperature)." },
    ],
    note:
      "Dry spells hurt palm harvests; extreme flooding disrupts picking. Plantation stocks (KLK, IOI) react sharply.",
  },
  {
    id: "velocity-fx-beta",
    title: "Retail News Velocity & FX Beta",
    latex: [
      "\\text{Velocity} = \\frac{\\text{Volume}_{7\\text{d}} - \\bar{\\text{Volume}}_{90\\text{d}}}{\\sigma_{90\\text{d}}}",
      "\\beta_{\\text{FX}} = \\frac{\\text{Cov}(R_{\\text{Stock}}, \\, R_{\\text{USD/MYR}})}{\\text{Var}(R_{\\text{USD/MYR}})}",
    ],
    parameters: [
      { symbol: "Volume₇d", definition: "7-day news mention count vs 90-day baseline." },
      { symbol: "σ₉₀d", definition: "90-day standard deviation of mention volume." },
      { symbol: "β_FX", definition: "How much the stock moves when the Ringgit swings vs USD." },
    ],
  },
  {
    id: "sector-breadth",
    title: "Sector Market Breadth",
    latex: [
      "\\text{Breadth} = \\left( \\frac{\\text{Count}(P_i > \\text{MA20}_i)}{\\text{Total Sector Constituents}} \\right) \\times 100 - 50",
    ],
    note: "Share of sector stocks trading above their 20-day average, centered at 0.",
  },
];

export function LearnFactorSignalsContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          What Are Factor Signals?
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Think of this tab as a radar screen for stocks. Instead of guessing from headlines, the
          models scan real-world data — rainfall, news buzz, institutional buying, currency moves —
          and turn each signal into a simple score from{" "}
          <span className="font-semibold text-rose-400">−100 (Extremely Bearish)</span> to{" "}
          <span className="font-semibold text-gain">+100 (Extremely Bullish)</span>. Green scores
          suggest tailwinds; red scores warn of headwinds.
        </p>

        <div className="rounded-lg border border-neutral-800 bg-[#0d0d0d] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            Score Scale (+100 to −100)
          </p>
          <ul className="mt-2.5 space-y-2">
            {SCORE_SCALE.map((item) => (
              <li key={item.range} className="flex gap-2.5 text-[11px] leading-relaxed">
                <span className={`shrink-0 font-mono font-semibold tabular-nums ${item.tone}`}>
                  {item.range}
                </span>
                <span className="text-neutral-400">
                  <span className="font-semibold text-neutral-200">({item.label}):</span>{" "}
                  {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
            Real-World Example
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
            <span className="font-semibold text-gain">+21 Retail News &amp; Media Velocity:</span>{" "}
            Media mentions are about 21% above the normal 90-day baseline. That means healthy
            retail buying interest — people are paying attention — without hitting extreme FOMO
            peaks (+70 to +100) where markets often overbuy and reverse.
          </p>
        </aside>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Indicator Breakdown
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Weather & Agri Anomalies (Plantation stocks like KLK, IOI Corp)"
            measures="Tracks rainfall and temperature shocks in palm oil plantation regions vs historical norms."
            matters="Too little rain or flooding hurts harvests. Supply drops → palm oil prices often rise → plantation stock returns can spike or crash depending on the shock direction."
          />
          <IndicatorCard
            title="Institutional Accumulation Divergence (EPF / PNB Form 29B)"
            measures='Detects when "Big Money" quietly buys shares while the public sells or price stays flat.'
            matters="Follow the smart money. Stealth accumulation often precedes price rallies once the market catches on."
          />
          <IndicatorCard
            title="Cross-Currency FX Beta & Yield Spread Sensitivity"
            measures="How much exporter stocks benefit when the Ringgit weakens vs USD, and how sensitive sectors are to interest-rate shifts."
            matters="A weaker MYR boosts export earnings in local terms. Rate changes shift borrowing costs and sector rotation — gloves, tech, and banks react differently."
          />
          <IndicatorCard
            title="Retail News & Media Velocity"
            measures="How fast a stock is being talked about in news portals and social media vs its 90-day average."
            matters='Moderate buzz (+20 to +50) can confirm a healthy trend. Extreme hype (+70 to +100) often marks a temporary top — "buy the rumour, sell the news."'
          />
          <IndicatorCard
            title="Correlation Engine & Pearson R (e.g. −0.230)"
            measures="How closely two numbers move together on a scale from −1.0 to +1.0."
            matters="+1.0 = move together; −1.0 = move opposite; 0.0 = no relationship. Use this to spot mispricings when a factor diverges from price."
          />
        </div>
        <ul className="mt-2 space-y-1.5 rounded-lg border border-neutral-800/80 bg-[#0d0d0d] px-3 py-2.5 font-mono text-[10px] text-neutral-400">
          <li>
            <span className="text-gain">+1.0:</span> They move in the exact same direction.
          </li>
          <li>
            <span className="text-rose-400">−1.0:</span> When A goes up, B goes down.
          </li>
          <li>
            <span className="text-neutral-300">0.0:</span> No relationship at all.
          </li>
        </ul>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          How to Use This Tab in 3 Easy Steps
        </h3>
        <ol className="flex flex-col gap-2">
          <StepCard
            step={1}
            title="Scan the Factor Overview"
            body="Look at the top score grid. Strongly green scores (+20 to +50) mean multiple tailwinds align — odds favour bullish setups."
          />
          <StepCard
            step={2}
            title="Check Confidence %"
            body='Only act on signals with Conf % above 70. Low confidence means the data is thin or conflicting — wait for clearer readings.'
          />
          <StepCard
            step={3}
            title="Spot Divergences"
            body="When a factor drops (e.g. rainfall shock) but price hasn't reacted yet, you may have a buying window before the market catches up."
          />
        </ol>
      </section>
    </>
  );
}
