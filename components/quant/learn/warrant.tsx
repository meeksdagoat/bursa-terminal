import { IndicatorCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const WARRANT_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "black-scholes-call",
    title: "Call Warrant Fair Value (C)",
    latex: [
      "C = S_t \\cdot N(d_1) - K \\cdot e^{-r T} \\cdot N(d_2)",
      "d_1 = \\frac{\\ln(S_t / K) + \\left(r + \\frac{\\sigma^2}{2}\\right)T}{\\sigma \\sqrt{T}}, \\quad d_2 = d_1 - \\sigma \\sqrt{T}",
    ],
    parameters: [
      { symbol: "Sₜ", definition: "Spot price of the underlying (mother share) in MYR." },
      { symbol: "K", definition: "Strike / exercise price of the warrant." },
      { symbol: "T", definition: "Time to expiry in years." },
      { symbol: "r", definition: "Continuously compounded risk-free rate." },
      { symbol: "σ", definition: "Implied (or assumed) volatility of the underlying." },
      { symbol: "N(·)", definition: "Standard normal cumulative distribution function." },
    ],
    interpretation: [
      "N(d₁) is the risk-neutral probability weight on the stock; N(d₂) weights the discounted strike.",
      "Compare theoretical C with the last traded warrant price — a gap is premium, not automatically mispricing.",
    ],
  },
  {
    id: "greeks",
    title: "Option Greeks",
    latex: [
      "\\Delta = \\frac{\\partial C}{\\partial S} = N(d_1)",
      "\\Gamma = \\frac{\\partial^2 C}{\\partial S^2} = \\frac{N'(d_1)}{S_t \\, \\sigma \\sqrt{T}}",
      "\\Theta = \\frac{\\partial C}{\\partial T} = -\\frac{S_t N'(d_1)\\sigma}{2\\sqrt{T}} - r K e^{-r T} N(d_2)",
      "\\mathcal{V} = \\frac{\\partial C}{\\partial \\sigma} = S_t \\sqrt{T} \\, N'(d_1)",
    ],
    parameters: [
      { symbol: "Δ Delta", definition: "Sensitivity per RM 1.00 move in the underlying." },
      { symbol: "Γ Gamma", definition: "Rate of change of Delta — highest near ATM, short-dated." },
      { symbol: "Θ Theta", definition: "Daily time decay (usually negative for long warrants)." },
      { symbol: "𝒱 Vega", definition: "Sensitivity to implied volatility (per 1.00 vol point in the UI)." },
      { symbol: "N'(·)", definition: "Standard normal density — the bell-curve height at d₁." },
    ],
    note: "Bursa structured warrants also have a conversion ratio. Theoretical C is a per-share European call; divide by the ratio before comparing with the screen price.",
  },
];

export function LearnWarrantContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          The Math &amp; Model
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Black–Scholes is the continuous-time formula for a European call or put. Inputs are
          underlying price S, strike K, time to expiry T, risk-free rate r, and implied volatility
          σ. The model outputs a theoretical value you can compare with the warrant’s last traded
          price on Bursa.
        </p>
        <p className="text-[12px] leading-relaxed text-neutral-400">
          A binomial (Cox–Ross–Rubinstein) tree is the discrete cousin. For vanilla European
          warrants the two converge as steps increase. This tab prices with Black–Scholes; use the
          sliders as a live laboratory for S, K, T and IV.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Option Greeks Cheat-Sheet
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Delta (Δ)"
            measures="How much the warrant’s theoretical price moves if the underlying stock moves RM 1.00."
            matters="A call delta of 0.55 means roughly 55 sen of warrant value per ringgit in the mother share. Deep ITM calls approach 1; far OTM calls approach 0."
          />
          <IndicatorCard
            title="Gamma (Γ)"
            measures="The rate of change of Delta."
            matters="High gamma (typical near ATM, short-dated) means your hedge ratio is unstable. Low gamma (deep ITM/OTM or long-dated) means Delta is stickier."
          />
          <IndicatorCard
            title="Theta (Θ)"
            measures="Time decay: value lost simply by holding overnight, all else equal."
            matters="Theta is usually negative for long warrants. The last two weeks before expiry are when retail holders feel this most."
          />
          <IndicatorCard
            title="Vega (ν)"
            measures="Sensitivity to implied volatility, quoted per 1 volatility point."
            matters="If IV expands, long warrants can gain even if the stock is flat. If IV collapses after an event, they can lose even if you were right on direction."
          />
        </div>
      </section>

      <aside className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
          Bursa Context
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
          Structured call/put warrants on KLSE often trade with a conversion ratio and a liquidity
          premium. If last price sits well above Black–Scholes, you are paying up for gearing and
          access — not necessarily for mispricing. The pricer is a baseline, not an auto-trade.
        </p>
      </aside>
    </>
  );
}
