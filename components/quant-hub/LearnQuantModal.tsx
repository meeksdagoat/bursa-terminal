"use client";

import { LearnQuantModalShell } from "@/components/quant-hub/LearnQuantModalShell";
import {
  BACKTEST_ADVANCED,
  LearnBacktestContent,
} from "@/components/quant-hub/learn/backtest";
import {
  FACTOR_SIGNALS_ADVANCED,
  LearnFactorSignalsContent,
} from "@/components/quant-hub/learn/factor-signals";
import {
  FRONTIER_ADVANCED,
  LearnFrontierContent,
} from "@/components/quant-hub/learn/frontier";
import {
  LearnMonteCarloContent,
  MONTE_CARLO_ADVANCED,
} from "@/components/quant-hub/learn/monte-carlo";

export type LearnQuantTabId = "factors" | "monte-carlo" | "backtest" | "frontier";

const LEARN_MODAL_META: Record<
  LearnQuantTabId,
  { title: string; subtitle: string; advanced: typeof FACTOR_SIGNALS_ADVANCED }
> = {
  factors: {
    title: "Learn Factor Signals & Alt Data",
    subtitle:
      "No math degree required. Here is how multi-factor scores work and how to spot real trading edges from weather, flows, and media data.",
    advanced: FACTOR_SIGNALS_ADVANCED,
  },
  "monte-carlo": {
    title: "Learn Monte Carlo Simulation",
    subtitle:
      "Replace guesswork with probability. Understand drift, volatility, VaR, and why running more trials smooths your risk picture.",
    advanced: MONTE_CARLO_ADVANCED,
  },
  backtest: {
    title: "Learn Historical Backtesting",
    subtitle:
      "Test trading ideas against real past prices before risking capital. Win rate, profit factor, drawdowns, and benchmarks explained plainly.",
    advanced: BACKTEST_ADVANCED,
  },
  frontier: {
    title: "Learn Markowitz Efficient Frontier",
    subtitle:
      "Modern Portfolio Theory in plain English — how to blend stocks for the best return at the lowest risk, and how to read the chart.",
    advanced: FRONTIER_ADVANCED,
  },
};

type LearnQuantModalProps = {
  tab: LearnQuantTabId | null;
  open: boolean;
  onClose: () => void;
};

export function LearnQuantModal({ tab, open, onClose }: LearnQuantModalProps) {
  if (!tab) return null;

  const meta = LEARN_MODAL_META[tab];

  return (
    <LearnQuantModalShell
      open={open}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      advancedSections={meta.advanced}
    >
      {tab === "factors" ? <LearnFactorSignalsContent /> : null}
      {tab === "monte-carlo" ? <LearnMonteCarloContent /> : null}
      {tab === "backtest" ? <LearnBacktestContent /> : null}
      {tab === "frontier" ? <LearnFrontierContent /> : null}
    </LearnQuantModalShell>
  );
}

export { LearnQuantButton, QuantTabToolbar } from "@/components/quant-hub/learn-quant-shared";
