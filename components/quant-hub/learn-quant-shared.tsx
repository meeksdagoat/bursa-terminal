"use client";

import { Fragment, type ReactNode } from "react";
import { MathEquation } from "@/components/quant-hub/MathEquation";

export type FormulaParam = {
  symbol: string;
  definition: string;
};

export type AdvancedFormulaSection = {
  id: string;
  title: string;
  latex: string[];
  parameters?: FormulaParam[];
  interpretation?: string[];
  note?: string;
};

export function LearnQuantButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
    >
      💡 Learn {label}
    </button>
  );
}

export function QuantTabToolbar({
  title,
  learnLabel,
  onLearn,
  trailing,
}: {
  title: string;
  learnLabel?: string;
  onLearn?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
        {title}
      </h2>
      {trailing || (learnLabel && onLearn) ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {trailing}
          {learnLabel && onLearn ? <LearnQuantButton label={learnLabel} onClick={onLearn} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function IndicatorCard({
  title,
  measures,
  matters,
  titleClassName = "text-neutral-100",
}: {
  title: string;
  measures: string;
  matters: string;
  titleClassName?: string;
}) {
  return (
    <article className="rounded-lg border border-neutral-800 bg-[#0d0d0d] p-3">
      <h3 className={`text-[11px] font-semibold ${titleClassName}`}>{title}</h3>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        <span className="font-semibold text-neutral-300">What it measures:</span> {measures}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
        <span className="font-semibold text-neutral-300">Why it matters:</span> {matters}
      </p>
    </article>
  );
}

export function StepCard({ step, title, body }: { step: number; title: string; body: string }) {
  return (
    <li className="flex gap-3 rounded-lg border border-neutral-800 bg-[#0d0d0d] p-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 font-mono text-[10px] font-semibold text-amber-400">
        {step}
      </span>
      <div>
        <p className="text-[11px] font-semibold text-neutral-100">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{body}</p>
      </div>
    </li>
  );
}

function ParameterKeyTable({ parameters }: { parameters: FormulaParam[] }) {
  return (
    <div className="mt-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
        Parameter Key
      </p>
      <dl className="mt-2 grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 gap-y-1.5 rounded border border-neutral-800/80 bg-neutral-950/50 p-2.5">
        {parameters.map((param) => (
          <Fragment key={param.symbol}>
            <dt className="font-mono text-[10px] font-semibold text-amber-300/90">{param.symbol}</dt>
            <dd className="text-[10px] leading-relaxed text-neutral-400">{param.definition}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

export function AdvancedFormulaCard({ section }: { section: AdvancedFormulaSection }) {
  return (
    <article className="my-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300">
        {section.title}
      </h4>
      <div className="mt-2 space-y-2">
        {section.latex.map((expression) => (
          <div
            key={expression}
            className="katex-gold my-3 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4"
          >
            <MathEquation latex={expression} />
          </div>
        ))}
      </div>
      {section.parameters?.length ? <ParameterKeyTable parameters={section.parameters} /> : null}
      {section.interpretation?.length ? (
        <div className="mt-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Interpretation
          </p>
          <ul className="mt-1.5 space-y-1">
            {section.interpretation.map((line) => (
              <li key={line} className="text-[10px] leading-relaxed text-neutral-400">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {section.note ? (
        <p className="mt-3 border-t border-neutral-800/80 pt-2 text-[10px] leading-relaxed text-neutral-500">
          {section.note}
        </p>
      ) : null}
    </article>
  );
}

export const SCORE_SCALE = [
  {
    range: "+100",
    label: "Extremely Bullish",
    tone: "text-gain",
    description: "Strongest possible positive signal — conditions are unusually favourable.",
  },
  {
    range: "+20 to +50",
    label: "Moderately Bullish",
    tone: "text-emerald-400",
    description: "Above-normal positive momentum without extreme hype.",
  },
  {
    range: "0",
    label: "Neutral",
    tone: "text-neutral-300",
    description: "Typical, average conditions — no strong edge either way.",
  },
  {
    range: "−20 to −50",
    label: "Moderately Bearish",
    tone: "text-orange-400",
    description: "Below-average conditions that may drag on returns.",
  },
  {
    range: "−100",
    label: "Extremely Bearish",
    tone: "text-rose-400",
    description: "Strongest possible negative signal — unusually risky conditions.",
  },
] as const;
