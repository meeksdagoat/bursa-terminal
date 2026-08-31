"use client";

import { useEffect, useMemo, useState } from "react";
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

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? structuredClone(initial) : createCustomStrategyDraft());
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
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2
            id="strategy-builder-title"
            className="font-mono text-sm font-semibold text-neutral-100"
          >
            {variant === "edit" ? "Edit Custom Strategy" : "Create Custom Strategy"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 font-mono text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            Close
          </button>
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
              <label key={option.value} className="flex items-center gap-2 font-mono text-xs text-neutral-300">
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
            ))}
          </fieldset>

          {draft.executionType === "SPOT_ACCUMULATION" ? (
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
          ) : null}

          <ConditionSection
            title="Buy Rules (all must be true)"
            side="buy"
            conditions={draft.buyConditions}
            onChange={(buyConditions) => setDraft((d) => ({ ...d, buyConditions }))}
          />

          {draft.executionType !== "SPOT_ACCUMULATION" ? (
            <ConditionSection
              title="Sell Rules (all must be true)"
              side="sell"
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
            />
            <NumberField
              label="Take Profit %"
              value={draft.takeProfitPct ?? 0}
              onChange={(takeProfitPct) => setDraft((d) => ({ ...d, takeProfitPct }))}
            />
            <NumberField
              label="Trailing Stop %"
              value={draft.trailingStopPct ?? 0}
              onChange={(trailingStopPct) => setDraft((d) => ({ ...d, trailingStopPct }))}
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
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
  );
}

function ConditionSection({
  title,
  side,
  conditions,
  onChange,
}: {
  title: string;
  side: "buy" | "sell";
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
  onChange,
  onRemove,
  canRemove,
}: {
  condition: Condition;
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
