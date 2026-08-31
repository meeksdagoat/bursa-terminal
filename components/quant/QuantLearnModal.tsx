"use client";

import { LearnQuantModalShell } from "@/components/quant-hub/LearnQuantModalShell";
import { LearnQuantButton } from "@/components/quant-hub/learn-quant-shared";
import { LearnPairsContent, PAIRS_ADVANCED } from "@/components/quant/learn/pairs";
import { LearnRegimeContent, REGIME_ADVANCED } from "@/components/quant/learn/regime";
import { LearnVaRContent, VAR_ADVANCED } from "@/components/quant/learn/var";
import { LearnWarrantContent, WARRANT_ADVANCED } from "@/components/quant/learn/warrant";
import type { ReactNode } from "react";

export type NewQuantLearnId = "var" | "warrant" | "pairs" | "regime";

const LEARN_META: Record<
  NewQuantLearnId,
  {
    title: string;
    subtitle: string;
    advanced: typeof VAR_ADVANCED;
    content: () => ReactNode;
  }
> = {
  var: {
    title: "Learn Value at Risk (VaR)",
    subtitle:
      "How much can this position lose on a bad day — and how often is that still considered “normal”?",
    advanced: VAR_ADVANCED,
    content: LearnVaRContent,
  },
  warrant: {
    title: "Learn Black-Scholes Warrant Pricing",
    subtitle:
      "A fair-value compass for Bursa structured warrants — price, Greeks, and why premium is not the same as edge.",
    advanced: WARRANT_ADVANCED,
    content: LearnWarrantContent,
  },
  pairs: {
    title: "Learn Statistical Arbitrage (Pairs)",
    subtitle:
      "When two related stocks stretch too far apart, mean-reversion is the bet — Z-score is the trigger.",
    advanced: PAIRS_ADVANCED,
    content: LearnPairsContent,
  },
  regime: {
    title: "Learn HMM Market Regime Classification",
    subtitle:
      "Markets hide their “weather”. This tab infers bull, chop, or stress so you can switch playbooks instead of forcing one strategy through every climate.",
    advanced: REGIME_ADVANCED,
    content: LearnRegimeContent,
  },
};

type QuantLearnModalProps = {
  tab: NewQuantLearnId | null;
  open: boolean;
  onClose: () => void;
};

export function QuantLearnModal({ tab, open, onClose }: QuantLearnModalProps) {
  if (!tab) return null;

  const meta = LEARN_META[tab];
  const Content = meta.content;

  return (
    <LearnQuantModalShell
      open={open}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.subtitle}
      advancedSections={meta.advanced}
    >
      <Content />
    </LearnQuantModalShell>
  );
}

export function LearnStrategyButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return <LearnQuantButton label={label} onClick={onClick} />;
}
