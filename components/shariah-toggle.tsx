"use client";

import { ToggleSwitch } from "@/components/toggle-switch";
import { useShariahFilter } from "@/lib/use-shariah";

type ShariahToggleProps = {
  /** Compact pill for the mobile watchlist header. */
  compact?: boolean;
  className?: string;
};

export function ShariahToggle({ compact = false, className = "" }: ShariahToggleProps) {
  const { shariahOnly, setShariahOnly } = useShariahFilter();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shariahOnly}
      onClick={() => setShariahOnly(!shariahOnly)}
      title={
        shariahOnly
          ? "Showing Shariah-compliant names only"
          : "Show Shariah-compliant names only — hides conventional banks, insurers, gaming and brewers"
      }
      className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border transition-colors ${
        compact
          ? "min-h-8 px-1.5 py-0.5"
          : "min-h-8 px-1.5 py-0.5 md:min-h-0 md:px-2"
      } ${
        shariahOnly
          ? "border-gain/50 bg-gain/10 text-gain"
          : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
      } ${className}`}
    >
      {compact ? (
        <span className="font-mono text-xs uppercase tracking-wider">Shariah</span>
      ) : (
        <>
          <span className="hidden font-mono text-[9px] uppercase tracking-wider lg:inline">
            Shariah Only
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider lg:hidden">🌙</span>
        </>
      )}
      <ToggleSwitch checked={shariahOnly} compact={compact} />
    </button>
  );
}
