"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CONDITION_INDICATORS,
  CONDITION_INDICATORS_B,
  CONDITION_OPERATORS,
  STRATEGY_CATEGORIES,
  createCustomStrategyDraft,
  createEmptyCondition,
  formatConditionLabel,
  validateConditionPeriods,
  type Condition,
  type CustomStrategy,
  type StrategyCategory,
  type StrategyExecutionType,
} from "@/lib/quant/custom-strategy";
import {
  BACKTEST_TIMEFRAME_OPTIONS,
  DEFAULT_CUSTOM_STRATEGY_TIMEFRAME,
  type BacktestTimeframe,
} from "@/lib/quant/backtest-timeframe";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type StrategyBuilderModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (strategy: CustomStrategy) => void;
  initial?: CustomStrategy | null;
  variant?: "create" | "edit";
  onDelete?: (id: string) => void;
};

const INPUT =
  "rounded border border-neutral-800 bg-[#0d0d0d] px-2 py-1.5 font-mono text-xs text-neutral-200 outline-none focus:border-amber-400/40";
const SELECT = INPUT;

const EXECUTION_TYPE_OPTIONS: { value: StrategyExecutionType; label: string }[] = [
  { value: "STANDARD", label: "Standard Long/Short" },
  { value: "SPOT_ACCUMULATION", label: "Spot Accumulation / Buy-Only" },
];

const LEARN_CARD =
  "mt-1.5 rounded-md border border-amber-500/30 bg-neutral-900/90 p-2.5 font-sans text-xs leading-relaxed text-neutral-300";

function Term({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-amber-400">{children}</span>;
}

function LearnCard({ children }: { children: ReactNode }) {
  return <p className={LEARN_CARD}>{children}</p>;
}

const EXECUTION_TYPE_HELP: Record<StrategyExecutionType, ReactNode> = {
  STANDARD: (
    <>
      Allows the strategy to both <Term>BUY</Term> (go <Term>Long</Term> when bullish) and{" "}
      <Term>SELL/SHORT</Term> (profit when price drops). Best for active traders.
    </>
  ),
  SPOT_ACCUMULATION: (
    <>
      Only <Term>buys and holds</Term> asset shares (like spot stocks or crypto). Never takes{" "}
      <Term>short positions</Term>. Best for long-term investors.
    </>
  ),
};

const INDICATOR_HELP: Record<Condition["indicatorA"] | "VALUE", ReactNode> = {
  PRICE: (
    <>
      The live market <Term>closing price</Term> of the stock/asset.
    </>
  ),
  SMA: (
    <>
      The <Term>Simple Moving Average</Term> — average closing price over N days. Smooths out daily
      noise to show the general trend.
    </>
  ),
  EMA: (
    <>
      The <Term>Exponential Moving Average</Term> is similar to SMA, but gives more weight to recent
      days. Responds faster to sudden price changes.
    </>
  ),
  RSI: (
    <>
      <Term>Relative Strength Index</Term> is a momentum gauge from 0 to 100. Below 30 usually means{" "}
      <Term>Oversold</Term> (bargain buy area), while above 70 means <Term>Overbought</Term> (getting
      expensive).
    </>
  ),
  VOLUME: (
    <>
      The total number of shares/units traded. High <Term>volume</Term> confirms strong market
      conviction behind a price move.
    </>
  ),
  VALUE: (
    <>
      A fixed <Term>number</Term> you choose — for example RSI 30 or a price level of 10.50.
    </>
  ),
};

const OPERATOR_HELP: Record<Condition["operator"], ReactNode> = {
  ">": (
    <>
      <Term>Greater Than</Term> triggers when the left value rises higher than the right value.
    </>
  ),
  "<": (
    <>
      <Term>Less Than</Term> triggers when the left value drops below the right value.
    </>
  ),
  CROSSES_ABOVE: (
    <>
      <Term>Crosses Above</Term> triggers the exact moment an indicator pierces up through a
      line/level from below (e.g., Price crosses above SMA).
    </>
  ),
  CROSSES_BELOW: (
    <>
      <Term>Crosses Below</Term> triggers the exact moment an indicator pierces down through a
      line/level from above.
    </>
  ),
};

const RISK_HELP = {
  stopLoss: (
    <>
      Automatic safety net. If a trade drops by this percentage, it immediately sells to limit your
      maximum loss. This is your <Term>Stop Loss</Term>.
    </>
  ),
  takeProfit: (
    <>
      Automatic target price. When your trade gains this percentage, it closes to lock in your
      profit. This is your <Term>Take Profit</Term>.
    </>
  ),
  trailingStop: (
    <>
      A dynamic stop that moves up as your profit increases, securing gains while giving the trade
      room to grow. This is a <Term>Trailing Stop</Term>.
    </>
  ),
  spotTranche: (
    <>
      Each buy signal spends this <Term>% of leftover cash</Term>, so you can scale in over multiple
      signals instead of going all-in at once.
    </>
  ),
} as const;

function operatorLabel(operator: Condition["operator"]): string {
  if (operator === "CROSSES_ABOVE") return "Crosses Above";
  if (operator === "CROSSES_BELOW") return "Crosses Below";
  return operator;
}

export function StrategyBuilderModal({
  open,
  onClose,
  onSave,
  initial = null,
  variant = "create",
  onDelete,
}: StrategyBuilderModalProps) {
  const [draft, setDraft] = useState<CustomStrategy>(() => createCustomStrategyDraft());
  const [learningMode, setLearningMode] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? structuredClone(initial) : createCustomStrategyDraft());
    setLearningMode(false);
  }, [open, initial]);

  const validationError = useMemo(() => {
    if (!draft.name.trim()) return "Strategy name is required.";
    if (draft.buyConditions.length === 0) return "Add at least one buy rule.";
    if (draft.executionType !== "SPOT_ACCUMULATION" && draft.sellConditions.length === 0) {
      return "Add at least one sell rule.";
    }
    return validateConditionPeriods([...draft.buyConditions, ...draft.sellConditions]);
  }, [draft]);

  const handleSave = () => {
    if (validationError) return;
    onSave({
      ...draft,
      id: draft.id?.trim() || crypto.randomUUID(),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      sellConditions:
        draft.executionType === "SPOT_ACCUMULATION" ? [] : draft.sellConditions,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-builder-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-neutral-800 bg-[#121212] shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <h2
            id="strategy-builder-title"
            className="font-mono text-sm font-semibold text-neutral-100"
          >
            {variant === "edit" ? "Edit Custom Strategy" : "Create Custom Strategy"}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-pressed={learningMode}
              onClick={() => setLearningMode((on) => !on)}
              className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] font-medium transition-colors ${
                learningMode
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              💡 {learningMode ? "Hide Guide" : "Strategy Guide"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 font-mono text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              Strategy Name
            </span>
            <input
              className={INPUT}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="My Strategy"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                Category
              </span>
              <select
                className={SELECT}
                value={draft.category ?? "Custom"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category: e.target.value as StrategyCategory }))
                }
              >
                {STRATEGY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                Default Timeframe
              </span>
              <select
                className={SELECT}
                value={draft.defaultTimeframe ?? DEFAULT_CUSTOM_STRATEGY_TIMEFRAME}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    defaultTimeframe: e.target.value as BacktestTimeframe,
                  }))
                }
              >
                {BACKTEST_TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              Description (optional)
            </span>
            <input
              className={INPUT}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              Execution Type
            </legend>
            {EXECUTION_TYPE_OPTIONS.map((option) => (
              <div key={option.value}>
                <label className="flex items-center gap-2 font-mono text-xs text-neutral-300">
                  <input
                    type="radio"
                    name="executionType"
                    checked={(draft.executionType ?? "STANDARD") === option.value}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        executionType: option.value,
                        sellConditions:
                          option.value === "SPOT_ACCUMULATION" ? [] : d.sellConditions,
                      }))
                    }
                  />
                  {option.label}
                </label>
                {learningMode ? <LearnCard>{EXECUTION_TYPE_HELP[option.value]}</LearnCard> : null}
              </div>
            ))}
          </fieldset>

          {draft.executionType === "SPOT_ACCUMULATION" ? (
            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                  Buy Tranche (% of cash)
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={`${INPUT} w-24`}
                  value={draft.spotBuyPctOfCash ?? 25}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      spotBuyPctOfCash: Number(e.target.value) || 25,
                    }))
                  }
                />
              </label>
              {learningMode ? <LearnCard>{RISK_HELP.spotTranche}</LearnCard> : null}
            </div>
          ) : null}

          <ConditionSection
            title="Buy Rules (all must be true)"
            side="buy"
            learning={learningMode}
            conditions={draft.buyConditions}
            onChange={(buyConditions) => setDraft((d) => ({ ...d, buyConditions }))}
          />

          {draft.executionType !== "SPOT_ACCUMULATION" ? (
            <ConditionSection
              title="Sell Rules (all must be true)"
              side="sell"
              learning={learningMode}
              conditions={draft.sellConditions}
              onChange={(sellConditions) => setDraft((d) => ({ ...d, sellConditions }))}
            />
          ) : (
            <p className="font-mono text-[10px] text-neutral-500">
              Sell rules disabled in Spot Accumulation mode — exits use stop-loss / take-profit only.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              label="Stop Loss %"
              value={draft.stopLossPct ?? 0}
              onChange={(stopLossPct) => setDraft((d) => ({ ...d, stopLossPct }))}
              helper={learningMode ? RISK_HELP.stopLoss : null}
            />
            <NumberField
              label="Take Profit %"
              value={draft.takeProfitPct ?? 0}
              onChange={(takeProfitPct) => setDraft((d) => ({ ...d, takeProfitPct }))}
              helper={learningMode ? RISK_HELP.takeProfit : null}
            />
            <NumberField
              label="Trailing Stop %"
              value={draft.trailingStopPct ?? 0}
              onChange={(trailingStopPct) => setDraft((d) => ({ ...d, trailingStopPct }))}
              helper={learningMode ? RISK_HELP.trailingStop : null}
            />
          </div>

          {validationError ? (
            <p className="font-mono text-[11px] text-red-400">{validationError}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-800 px-4 py-3">
          {variant === "edit" && onDelete && draft.id ? (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="rounded border border-red-900/60 px-3 py-1.5 font-mono text-xs text-red-400 hover:bg-red-950/40"
            >
              Delete Strategy
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-700 px-3 py-1.5 font-mono text-xs text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(validationError)}
              onClick={handleSave}
              className="rounded bg-amber-500/90 px-3 py-1.5 font-mono text-xs font-semibold text-black disabled:opacity-50"
            >
              Save Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helper?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </span>
        <input
          type="number"
          min={0}
          step={0.5}
          className={INPUT}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      </label>
      {helper ? <LearnCard>{helper}</LearnCard> : null}
    </div>
  );
}

function ConditionSection({
  title,
  side,
  learning,
  conditions,
  onChange,
}: {
  title: string;
  side: "buy" | "sell";
  learning: boolean;
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
}) {
  return (
    <section className="rounded border border-neutral-800 bg-[#0d0d0d] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-400">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => onChange([...conditions, createEmptyCondition(side)])}
          className="font-mono text-[10px] text-amber-400 hover:text-amber-300"
        >
          + Add {side === "buy" ? "Buy" : "Sell"} Rule
        </button>
      </div>

      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={`${side}-${index}`}
            condition={condition}
            learning={learning}
            onChange={(next) => {
              const copy = [...conditions];
              copy[index] = next;
              onChange(copy);
            }}
            onRemove={() => onChange(conditions.filter((_, i) => i !== index))}
            canRemove={conditions.length > 1}
          />
        ))}
      </div>
    </section>
  );
}

function ConditionRow({
  condition,
  learning,
  onChange,
  onRemove,
  canRemove,
}: {
  condition: Condition;
  learning: boolean;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const showPeriodA = condition.indicatorA !== "PRICE";
  const showPeriodB =
    condition.indicatorB !== "VALUE" && condition.indicatorB !== "PRICE";
  const showValueB = condition.indicatorB === "VALUE";

  return (
    <div className="rounded border border-neutral-800/80 p-2">
      <div className="mb-1 font-mono text-[10px] text-neutral-500">
        {formatConditionLabel(condition)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          className={SELECT}
          value={condition.indicatorA}
          onChange={(e) =>
            onChange({
              ...condition,
              indicatorA: e.target.value as Condition["indicatorA"],
            })
          }
        >
          {CONDITION_INDICATORS.map((indicator) => (
            <option key={indicator} value={indicator}>
              {indicator}
            </option>
          ))}
        </select>

        {showPeriodA ? (
          <input
            type="number"
            min={1}
            max={200}
            className={INPUT}
            value={condition.periodA}
            onChange={(e) =>
              onChange({ ...condition, periodA: Number(e.target.value) || 1 })
            }
          />
        ) : (
          <span />
        )}

        <select
          className={SELECT}
          value={condition.operator}
          onChange={(e) =>
            onChange({
              ...condition,
              operator: e.target.value as Condition["operator"],
            })
          }
        >
          {CONDITION_OPERATORS.map((operator) => (
            <option key={operator} value={operator}>
              {operatorLabel(operator)}
            </option>
          ))}
        </select>

        <select
          className={SELECT}
          value={condition.indicatorB}
          onChange={(e) =>
            onChange({
              ...condition,
              indicatorB: e.target.value as Condition["indicatorB"],
            })
          }
        >
          {CONDITION_INDICATORS_B.map((indicator) => (
            <option key={indicator} value={indicator}>
              {indicator}
            </option>
          ))}
        </select>

        {showPeriodB ? (
          <input
            type="number"
            min={1}
            max={200}
            className={INPUT}
            value={condition.periodB}
            onChange={(e) =>
              onChange({ ...condition, periodB: Number(e.target.value) || 1 })
            }
          />
        ) : null}

        {showValueB ? (
          <input
            type="number"
            className={INPUT}
            value={condition.valueB}
            onChange={(e) =>
              onChange({ ...condition, valueB: Number(e.target.value) || 0 })
            }
          />
        ) : null}
      </div>

      {learning ? (
        <div className="mt-2 space-y-1">
          <LearnCard>{INDICATOR_HELP[condition.indicatorA]}</LearnCard>
          <LearnCard>{OPERATOR_HELP[condition.operator]}</LearnCard>
          <LearnCard>{INDICATOR_HELP[condition.indicatorB]}</LearnCard>
        </div>
      ) : null}

      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 font-mono text-[10px] text-red-400 hover:text-red-300"
        >
          Remove rule
        </button>
      ) : null}
    </div>
  );
}
