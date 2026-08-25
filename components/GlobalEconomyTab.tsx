"use client";

import { GlobalMarketHeatmap } from "@/components/GlobalMarketHeatmap";
import { GlobalPolicyMatrix } from "@/components/GlobalPolicyMatrix";
import { MacroCurrencyMatrix } from "@/components/MacroCurrencyMatrix";
import { TradingViewTickers } from "@/components/tradingview-tickers";
import type { BnmPayload, EconomyPayload, GlobalEconomyPayload } from "@/lib/types";

type GlobalEconomyTabProps = {
  snapshot: GlobalEconomyPayload | null;
  snapshotError: string | null;
  bnm: BnmPayload | null;
  malaysia: EconomyPayload | null;
};

/**
 * Central Global Economy workbench: live tickers on top, then the macro
 * matrix / policy table / S&P heatmap row above the calendar.
 */
export function GlobalEconomyTab({
  snapshot,
  snapshotError,
  bnm,
  malaysia,
}: GlobalEconomyTabProps) {
  const cpo = malaysia?.commodities.find((item) => item.id === "cpo") ?? null;

  return (
    <>
      {snapshotError ? (
        <p className="border-b border-neutral-800 px-3 py-1.5 font-mono text-[10px] text-loss">
          MACRO FEED · {snapshotError}
        </p>
      ) : null}

      <TradingViewTickers />

      <p className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-neutral-700">
        STREAMING LIVE • TRADINGVIEW WEBSOCKET
      </p>

      <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-3">
        <MacroCurrencyMatrix markets={snapshot?.markets ?? []} bnm={bnm} cpo={cpo} />
        <GlobalPolicyMatrix
          rates={snapshot?.rates ?? []}
          opr={bnm?.opr ?? null}
          malaysiaCpi={malaysia?.cpi ?? null}
        />
        <GlobalMarketHeatmap />
      </div>
    </>
  );
}
