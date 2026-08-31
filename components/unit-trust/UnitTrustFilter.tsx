"use client";

import {
  UNIT_TRUST_CATEGORY_FILTERS,
  UNIT_TRUST_PROVIDERS,
  type UnitTrustCategoryFilter,
} from "@/lib/unit-trust/types";
import type { UnitTrustFilterState, UnitTrustProviderFilter } from "@/lib/unit-trust-filters";

const PILL_ACTIVE = "border-violet-500/50 bg-violet-500/15 text-violet-300";
const PILL_IDLE =
  "border-neutral-800 bg-[#121212] text-neutral-500 hover:border-neutral-700 hover:text-neutral-300";

type UnitTrustFilterProps = {
  filters: UnitTrustFilterState;
  resultCount: number;
  onChange: (next: UnitTrustFilterState) => void;
};

export function UnitTrustFilter({ filters, resultCount, onChange }: UnitTrustFilterProps) {
  const providers: UnitTrustProviderFilter[] = ["All Companies", ...UNIT_TRUST_PROVIDERS];

  return (
    <section className="space-y-3 border border-line bg-[#121212] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Filter &amp; search
        </h2>
        <span className="font-mono text-[9px] text-neutral-600">
          {resultCount.toLocaleString()} fund{resultCount === 1 ? "" : "s"}
        </span>
      </div>

      <label className="block">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Search funds
        </span>
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="ASB, ASN Equity 3, Public Ittikal…"
          className="h-9 w-full border border-neutral-800 bg-[#0a0a0a] px-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-600 focus:border-violet-500/50 focus:outline-none"
        />
      </label>

      <div>
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Management company
        </p>
        <div className="flex flex-wrap gap-1.5">
          {providers.map((provider) => {
            const active = filters.provider === provider;
            const label = provider === "ASNB" ? "ASNB (Amanah Saham)" : provider;
            return (
              <button
                key={provider}
                type="button"
                onClick={() => onChange({ ...filters, provider })}
                className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                  active ? PILL_ACTIVE : PILL_IDLE
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
          Fund type / category
        </p>
        <div className="flex flex-wrap gap-1.5">
          {UNIT_TRUST_CATEGORY_FILTERS.map((category) => {
            const active = filters.category === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onChange({ ...filters, category })}
                className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                  active ? PILL_ACTIVE : PILL_IDLE
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export type { UnitTrustCategoryFilter };
