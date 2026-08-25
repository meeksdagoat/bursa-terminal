"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatPct, formatPrice, formatVolume } from "@/lib/format";

function displayVolume(volume: number | null) {
  return volume != null && volume > 0 ? formatVolume(volume) : "—";
}
import { resolveMoversBoard } from "@/lib/movers-fallback";
import type { MoverRow, MoversPayload } from "@/lib/types";
import { terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";

const MOVERS_REFRESH_MS = 60 * 1000;
const BOARD_SIZE = 5;

export function MarketOverview() {
  const movers = useLiveData<MoversPayload>("/api/movers", MOVERS_REFRESH_MS);
  const board = useMemo(() => resolveMoversBoard(movers.data), [movers.data]);
  const gainers = board.gainers.slice(0, BOARD_SIZE);
  const losers = board.losers.slice(0, BOARD_SIZE);
  const feed = [...gainers, ...losers];
  const usingFallback = board.source === "fallback" || Boolean(movers.error);
  const sessionLabel = board.lastSession || usingFallback ? "LAST SESSION" : "LIVE";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          {sessionLabel}
          {board.marketState ? ` · ${board.marketState}` : ""}
        </p>
        <button
          type="button"
          onClick={() => movers.refresh()}
          className="inline-flex min-h-9 items-center rounded-md border border-white/15 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-300 hover:border-gain/40 hover:text-gain"
        >
          {movers.loading ? "Scanning…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <MoversColumn title="Top gainers" rows={gainers} loading={movers.loading} tone="gain" />
        <MoversColumn title="Top losers" rows={losers} loading={movers.loading} tone="loss" />
      </div>

      <MoversFeed rows={feed} onRetry={movers.refresh} reconnecting={movers.loading} />
    </div>
  );
}

function pctPill(changePct: number | null) {
  const up = (changePct ?? 0) >= 0;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
        up ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
      }`}
    >
      {formatPct(changePct)}
    </span>
  );
}

function MoversColumn({
  title,
  rows,
  loading,
  tone,
}: {
  title: string;
  rows: MoverRow[];
  loading: boolean;
  tone: "gain" | "loss";
}) {
  return (
    <div>
      <h3
        className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
          tone === "gain" ? "text-gain" : "text-loss"
        }`}
      >
        {title}
      </h3>
      <ul className="divide-y divide-white/5">
        {rows.map((row, index) => (
          <li key={row.symbol}>
            <Link
              href={terminalHref(row.symbol)}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
            >
              <span className="w-4 shrink-0 font-mono text-[10px] text-neutral-600">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-neutral-100">{row.name}</span>
                <span className="font-mono text-[10px] text-neutral-600">
                  {row.code} · VOL {displayVolume(row.quote.volume)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[13px] text-white">
                  RM {formatPrice(row.quote.price)}
                </span>
                {pctPill(row.quote.changePct)}
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center font-mono text-[10px] text-neutral-600">
            {loading ? "SCANNING…" : "NO MOVES"}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function MoversFeed({
  rows,
  onRetry,
  reconnecting,
}: {
  rows: MoverRow[];
  onRetry: () => void;
  reconnecting: boolean;
}) {
  const tape = [...rows, ...rows];

  return (
    <div className="border-t border-white/10">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          Movers feed
        </h3>
        <button
          type="button"
          onClick={onRetry}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500 hover:text-gain"
        >
          {reconnecting ? "Reconnecting…" : "Reconnect"}
        </button>
      </div>
      <div className="overflow-hidden border-t border-white/5 py-2">
        <div className="tape-track flex">
          {tape.map((row, index) => {
            const up = (row.quote.changePct ?? 0) >= 0;
            return (
              <Link
                key={`${row.symbol}-${index}`}
                href={terminalHref(row.symbol)}
                className="flex shrink-0 items-center gap-2 px-4"
              >
                <span className="font-mono text-[11px] text-neutral-400">{row.code}</span>
                <span className="font-mono text-[11px] text-white">RM {formatPrice(row.quote.price)}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                    up ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                  }`}
                >
                  {formatPct(row.quote.changePct)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
