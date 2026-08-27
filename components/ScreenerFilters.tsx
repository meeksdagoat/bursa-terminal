"use client";

import {
  CAP_OPTIONS,
  type ScreenerFiltersState,
} from "@/lib/screener-filters";
import { ToggleSwitch } from "@/components/toggle-switch";
import type { ScreenerCapSize } from "@/lib/types";

type ScreenerFiltersProps = {
  filters: ScreenerFiltersState;
  peBoundMax: number;
  yieldBoundMax: number;
  sectors: { label: string; values: string[] }[];
  resultCount: number;
  universeCount: number;
  onChange: (next: ScreenerFiltersState) => void;
  onReset: () => void;
};

export function ScreenerFilters({
  filters,
  peBoundMax,
  yieldBoundMax,
  sectors,
  resultCount,
  universeCount,
  onChange,
  onReset,
}: ScreenerFiltersProps) {
  function patch(partial: Partial<ScreenerFiltersState>) {
    onChange({ ...filters, ...partial });
  }

  function toggleCap(id: ScreenerCapSize) {
    const selected = filters.caps.includes(id)
      ? filters.caps.filter((cap) => cap !== id)
      : [...filters.caps, id];
    patch({ caps: selected.length === 0 ? CAP_OPTIONS.map((option) => option.id) : selected });
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border border-line bg-panel p-3 lg:w-72">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Filters
          </h2>
          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
            {resultCount.toLocaleString()} / {universeCount.toLocaleString()} names
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500 hover:text-gain md:min-h-0"
        >
          Reset
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Sector
        </span>
        <select
          value={filters.sector}
          onChange={(event) => patch({ sector: event.target.value })}
          className="min-h-11 border border-line bg-[#0e0e0e] px-2 font-mono text-[12px] text-neutral-200 md:min-h-9"
        >
          <option value="">All sectors</option>
          {sectors.map((sector) => (
            <option key={sector.label} value={sector.label}>
              {sector.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="min-w-0">
        <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          P/E range
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField
            label="Min"
            value={filters.peMin}
            min={0}
            max={filters.peMax}
            onChange={(peMin) => patch({ peMin: Math.min(peMin, filters.peMax) })}
          />
          <NumberField
            label="Max"
            value={filters.peMax}
            min={filters.peMin}
            max={peBoundMax}
            onChange={(peMax) => patch({ peMax: Math.max(peMax, filters.peMin) })}
          />
        </div>
        <DualSlider
          min={0}
          max={peBoundMax}
          low={filters.peMin}
          high={filters.peMax}
          onLow={(peMin) => patch({ peMin: Math.min(peMin, filters.peMax) })}
          onHigh={(peMax) => patch({ peMax: Math.max(peMax, filters.peMin) })}
        />
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Dividend yield % min
        </legend>
        <div className="mt-2">
          <NumberField
            label="Min %"
            value={filters.yieldMin}
            min={0}
            max={yieldBoundMax}
            step={0.1}
            onChange={(yieldMin) => patch({ yieldMin })}
          />
        </div>
        <input
          type="range"
          min={0}
          max={yieldBoundMax}
          step={0.1}
          value={filters.yieldMin}
          onChange={(event) => patch({ yieldMin: Number(event.target.value) })}
          className="mt-2 w-full accent-gain"
          aria-label="Minimum dividend yield"
        />
      </fieldset>

      <fieldset>
        <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Market cap
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {CAP_OPTIONS.map((option) => {
            const active = filters.caps.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                title={option.hint}
                aria-pressed={active}
                onClick={() => toggleCap(option.id)}
                className={`min-h-11 border px-1 font-mono text-[10px] uppercase tracking-[0.12em] md:min-h-9 ${
                  active
                    ? "border-gain/40 bg-gain/10 text-gain"
                    : "border-line text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 font-mono text-[9px] text-neutral-600">
          Small &lt; RM 300M · Mid RM 300M–2B · Large ≥ RM 2B
        </p>
      </fieldset>

      <button
        type="button"
        role="switch"
        aria-checked={filters.shariahOnly}
        onClick={() => patch({ shariahOnly: !filters.shariahOnly })}
        className={`flex min-h-11 items-center justify-between gap-3 border px-2.5 py-2 focus:outline-none md:min-h-9 ${
          filters.shariahOnly
            ? "border-gain/40 bg-gain/10 text-gain"
            : "border-line text-neutral-400 hover:text-neutral-200"
        }`}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
          Shariah compliant only
        </span>
        <ToggleSwitch checked={filters.shariahOnly} />
      </button>
    </aside>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, next)));
        }}
        className="min-h-11 border border-line bg-[#0e0e0e] px-2 font-mono text-[12px] text-neutral-100 md:min-h-9"
      />
    </label>
  );
}

function DualSlider({
  min,
  max,
  low,
  high,
  onLow,
  onHigh,
}: {
  min: number;
  max: number;
  low: number;
  high: number;
  onLow: (value: number) => void;
  onHigh: (value: number) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={low}
        onChange={(event) => onLow(Number(event.target.value))}
        className="w-full accent-gain"
        aria-label="Minimum P/E"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={high}
        onChange={(event) => onHigh(Number(event.target.value))}
        className="w-full accent-gain"
        aria-label="Maximum P/E"
      />
    </div>
  );
}
