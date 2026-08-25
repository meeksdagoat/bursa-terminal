"use client";

import { GlobalMarketHeatmap } from "@/components/GlobalMarketHeatmap";
import { GlobalPolicyMatrix } from "@/components/GlobalPolicyMatrix";
import { GlobalTickerCards } from "@/components/GlobalTickerCards";
import { MacroCurrencyMatrix } from "@/components/MacroCurrencyMatrix";
import type { BnmPayload, EconomyPayload, GlobalEconomyPayload } from "@/lib/types";

type GlobalEconomyTabProps = {
  snapshot: GlobalEconomyPayload | null;
  snapshotError: string | null;
  bnm: BnmPayload | null;
  malaysia: EconomyPayload | null;
};

/**
 * Central Global Economy workbench.
 *
 * The tape is native React cards (`GlobalTickerCards`) — TradingView
 * single-quote iframes are not imported or rendered here. The S&P heatmap
 * iframe below is a separate dark widget. The two-column event calendar
 * (`GlobalEventCalendar`) sits in the desk panel beneath this board.
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

      <GlobalTickerCards />

      <p className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-neutral-700">
        LIVE TAPE · TRADINGVIEW WEBSOCKET · FLASH ON TICK
      </p>

      <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-3">
        <div className="min-w-0">
          <MacroCurrencyMatrix markets={snapshot?.markets ?? []} bnm={bnm} cpo={cpo} />
        </div>
        <div className="min-w-0">
          <GlobalPolicyMatrix
            rates={snapshot?.rates ?? []}
            opr={bnm?.opr ?? null}
            malaysiaCpi={malaysia?.cpi ?? null}
          />
        </div>
        <div className="min-w-0">
          <GlobalMarketHeatmap />
        </div>
      </div>
    </>
  );
}
