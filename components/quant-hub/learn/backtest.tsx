import { IndicatorCard, StepCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

export const BACKTEST_ADVANCED: AdvancedFormulaSection[] = [
  {
    id: "profit-factor",
    title: "Profit Factor",
    latex: ["\\text{Profit Factor} = \\frac{\\sum \\text{Gross Profits}}{\\sum |\\text{Gross Losses}|}"],
    parameters: [
      { symbol: "Gross Profits", definition: "Sum of all winning trade P&L." },
      { symbol: "Gross Losses", definition: "Sum of absolute losing trade P&L." },
    ],
    interpretation: [
      "PF > 1.0: Strategy made more than it lost overall.",
      "PF = 3.39: Every RM 1.00 lost was paired with RM 3.39 gained — strong edge if sample size is large enough.",
    ],
  },
  {
    id: "max-drawdown",
    title: "Maximum Drawdown (Peak-to-Trough)",
    latex: [
      "\\text{Max DD} = \\max_t \\left( \\frac{\\text{Peak}_t - \\text{Equity}_t}{\\text{Peak}_t} \\right)",
    ],
    parameters: [
      { symbol: "Peak_t", definition: "Highest equity value seen before time t." },
      { symbol: "Equity_t", definition: "Portfolio value at time t during the backtest." },
    ],
    note: "Measures the deepest hole your account would have fallen into — critical for position sizing and psychological tolerance.",
  },
  {
    id: "win-rate",
    title: "Win Rate",
    latex: ["\\text{Win Rate \\%} = \\frac{\\text{Winning Trades}}{\\text{Total Closed Trades}} \\times 100"],
    note: "A 40% win rate can still be profitable if winners are much larger than losers (high profit factor).",
  },
];

export function LearnBacktestContent() {
  return (
    <>
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          What Is Backtesting?
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          Backtesting is a time machine for trading ideas. You pick a strategy (RSI bounce, moving-average
          crossover, etc.), run it against{" "}
          <span className="font-semibold text-neutral-200">real historical OHLCV price data</span>, and
          see what would have happened — win rate, total return, worst drawdown, and trade log. It does
          not predict the future, but it shows whether an idea had a real edge in the past.
        </p>
        <aside className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/90">
            Plain English Takeaway
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">
            Before risking real money, ask:{" "}
            <em>&ldquo;If I had traded this rule every day for the last 3 years, would I be ahead or
            underwater?&rdquo;</em> That is what this engine answers.
          </p>
        </aside>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Key Metrics Explained
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Win Rate %"
            measures="Percentage of closed trades that ended in profit."
            matters="Higher is nicer, but not everything. A 35% win rate with big winners can beat a 70% win rate with tiny gains and large losses."
          />
          <IndicatorCard
            title="Profit Factor"
            measures="Gross profit divided by gross loss."
            matters="3.39 means you made RM 3.39 for every RM 1.00 lost. Below 1.0 = net loser. Above 2.0 = generally strong if backed by enough trades."
          />
          <IndicatorCard
            title="Max Drawdown (Max DD)"
            measures="The worst peak-to-trough drop in your equity curve during the test period."
            matters="If Max DD is −25%, your account would have been down a quarter from its high at some point. Can you stomach that? If not, reduce size or change strategy."
          />
          <IndicatorCard
            title="Benchmarks — FBM KLCI & S&P 500"
            measures="Compares your strategy equity curve against buy-and-hold index baselines."
            matters="Beating KLCI means you outperformed the local market. The S&P 500 line shows global risk-on context — useful when testing exporters or dual-listed names."
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">
          Trade Frequency Insights
        </h3>
        <div className="flex flex-col gap-2.5">
          <IndicatorCard
            title="Slow Trend Strategies (20/50 MA Crossover, MACD)"
            measures="Few signals — often only 4–8 trades over 5 years on daily data."
            matters="Each trade carries more weight. One bad streak can dominate results. Good for patient swing traders; not for daily action seekers."
          />
          <IndicatorCard
            title="Fast Oscillators (RSI 14, Stochastic, EMA 5/20, Bollinger)"
            measures="Many signals — 50–100+ trades per year on the same data."
            matters="Results average out faster (more statistical samples) but commissions and slippage matter more. Win rate and profit factor need tighter scrutiny."
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
            title="Pick Strategy & Lookback"
            body="Match strategy speed to your style — oscillators for active traders, MA crossovers for swing holders. Use 3Y+ for trend tests."
          />
          <StepCard
            step={2}
            title="Read Max DD Before Total Return"
            body="A +80% return with −40% drawdown may be unusable if you cannot hold through the valley. Size positions to survive Max DD."
          />
          <StepCard
            step={3}
            title="Compare vs Benchmarks"
            body="If your strategy barely beats KLCI after all that trading, buy-and-hold may be simpler. Outperformance vs S&P adds global context."
          />
        </ol>
      </section>
    </>
  );
}
