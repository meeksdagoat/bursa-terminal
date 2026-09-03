import { IndicatorCard, StepCard, type AdvancedFormulaSection } from "@/components/quant-hub/learn-quant-shared";

const STRATEGY_CHEAT_SHEET = [
  {
    title: "RSI Mean-Reversion (14D / 30-70)",
    whatItIs: 'A "rubber band" indicator measuring whether a stock is stretched too far.',
    howItTrades:
      "Buys when oversold (below 30 — the stock dropped too fast) and sells when overbought (above 70 — the stock rose too fast).",
  },
  {
    title: "Bollinger Band Breakout (20, 2.0)",
    whatItIs: "A volatility envelope around the price.",
    howItTrades:
      "Triggers a buy when the price explodes above the top band (predicting a momentum breakout) or a sell when it pierces the lower band.",
  },
  {
    title: "Fast EMA Crossover (5 / 20)",
    whatItIs: "A fast-reacting trend trigger using Exponential Moving Averages.",
    howItTrades:
      "Buys when the 5-day average line crosses ABOVE the 20-day line (short-term momentum turning up). Sells when it crosses BELOW.",
  },
  {
    title: "Stochastic Oscillator (%K 14, %D 3)",
    whatItIs:
      "A short-term momentum gauge tracking where the stock closed relative to its recent high/low range.",
    howItTrades:
      "Ideal for sideways markets. Buys when lines cross below 20 (oversold turnaround) and sells above 80 (overbought peak).",
  },
  {
    title: "MACD Histogram Zero-Flip (12, 26, 9)",
    whatItIs: "Measures the difference between short-term and long-term momentum.",
    howItTrades:
      "Buys the exact moment momentum flips positive (histogram bars cross above the zero line) and exits when momentum turns negative.",
  },
  {
    title: "Keltner Channel Reversal (20 EMA, 2x ATR)",
    whatItIs: "Uses Average True Range (ATR) volatility channels to detect extreme price stretches.",
    howItTrades:
      'Catches "over-extended" moves. Buys when price dips outside the lower channel and snaps back in.',
  },
  {
    title: "Parabolic SAR Trailing Flip (0.02, 0.2)",
    whatItIs:
      "A strict trailing stop-and-reverse system represented by dots above or below price candles.",
    howItTrades:
      "Flips LONG when dots jump BELOW candles (uptrend start) and flips SHORT/EXIT when dots move ABOVE candles.",
  },
] as const;

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
          Indicator & Strategy Cheat Sheet (For Beginners)
        </h3>
        <p className="text-[12px] leading-relaxed text-neutral-300">
          These seven rules match the Strategy dropdown on the Historical Backtest Engine. Read{" "}
          <span className="font-semibold text-neutral-200">What it is</span> to picture the indicator,
          then <span className="font-semibold text-neutral-200">How it trades</span> to know when the
          engine buys or sells.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {STRATEGY_CHEAT_SHEET.map((entry) => (
            <article
              key={entry.title}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
            >
              <h4 className="text-[11px] font-semibold text-neutral-100">{entry.title}</h4>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                <span className="font-semibold text-neutral-200">What it is:</span> {entry.whatItIs}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
                <span className="font-semibold text-neutral-200">How it trades:</span> {entry.howItTrades}
              </p>
            </article>
          ))}
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
            body="Use the cheat sheet above to match a rule to your style — oscillators for active traders, crossovers and SAR for trend followers. Use 3Y+ for trend tests."
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
