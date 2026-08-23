"use client";

import { FormEvent } from "react";
import {
  changeClass,
  formatFx,
  formatKlDate,
  formatOpr,
  formatPct,
  formatPrice,
} from "@/lib/format";
import type { BnmPayload, Quote } from "@/lib/types";

type HeaderBarProps = {
  bnm: BnmPayload | null;
  index: Quote | null;
  onSearch: (query: string) => void;
};

export function HeaderBar({ bnm, index, onSearch }: HeaderBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = String(new FormData(event.currentTarget).get("ticker") ?? "");
    onSearch(submitted);
  }

  const opr = bnm?.opr ?? null;

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-3">
      <div className="flex items-baseline gap-2 border-r border-line pr-3">
        <span className="text-[13px] font-semibold tracking-[0.18em] text-white">BURSA</span>
        <span className="text-[13px] font-semibold tracking-[0.18em] text-gain">TERMINAL</span>
      </div>

      <form onSubmit={handleSubmit} className="flex min-w-0 max-w-md flex-1 items-center gap-1">
        <label className="sr-only" htmlFor="ticker-search">
          Search tickers
        </label>
        <input
          id="ticker-search"
          name="ticker"
          type="search"
          placeholder="Search ticker — Maybank 1155.KL"
          className="h-7 w-full rounded-sm border border-line bg-[#0a0a0a] px-2.5 font-mono text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-gain/50"
        />
        <button
          type="submit"
          className="h-7 shrink-0 border border-line bg-[#1a1a1a] px-2 font-mono text-[9px] tracking-wider text-neutral-400 hover:text-gain"
        >
          GO
        </button>
      </form>

      <div className="ml-auto flex items-stretch divide-x divide-line border border-line">
        {(bnm?.rates ?? []).map((rate) => (
          <Tile
            key={rate.pair}
            label={rate.pair}
            note={`BNM ${bnm?.session ?? ""} · ${formatKlDate(rate.date)}`}
            value={formatFx(rate.rate)}
            changePct={rate.changePct}
          />
        ))}

        {!bnm ? (
          <>
            <Tile label="USD/MYR" note="BNM" value="—" changePct={null} />
            <Tile label="SGD/MYR" note="BNM" value="—" changePct={null} />
          </>
        ) : null}

        <Tile
          label="FBM KLCI"
          note="^KLSE · 15m delay"
          value={formatPrice(index?.price)}
          changePct={index?.changePct ?? null}
        />

        <Tile
          label="BNM OPR"
          note={opr?.effectiveDate ? `eff. ${formatKlDate(opr.effectiveDate)}` : "BNM"}
          value={formatOpr(opr?.level)}
          changePct={null}
          badge={
            opr?.changeBps != null
              ? opr.changeBps === 0
                ? "UNCH"
                : `${opr.changeBps > 0 ? "+" : ""}${opr.changeBps}bps`
              : undefined
          }
        />
      </div>
    </header>
  );
}

type TileProps = {
  label: string;
  note: string;
  value: string;
  changePct: number | null;
  badge?: string;
};

function Tile({ label, note, value, changePct, badge }: TileProps) {
  return (
    <div className="flex min-w-[132px] flex-col justify-center px-3 py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <span className="font-mono text-[8px] text-neutral-700">{note}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[12px] text-neutral-100">{value}</span>
        {badge ? (
          <span className="font-mono text-[10px] text-neutral-500">{badge}</span>
        ) : (
          <span className={`font-mono text-[10px] ${changeClass(changePct)}`}>
            {formatPct(changePct)}
          </span>
        )}
      </div>
    </div>
  );
}
