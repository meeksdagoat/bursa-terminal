"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPct, formatPrice, formatVolume } from "@/lib/format";
import { resolveMoversBoard } from "@/lib/movers-fallback";
import type { MoverRow, MoversPayload } from "@/lib/types";
import { terminalHref } from "@/lib/universe";
import { useLiveData } from "@/lib/use-live-data";
import { MoverRowSkeleton } from "@/components/skeleton";

function displayVolume(volume: number | null) {
  return volume != null && volume > 0 ? formatVolume(volume) : "—";
}

const MOVERS_REFRESH_MS = 60 * 1000;
const BOARD_SIZE = 5;

type BoardTab = "gainers" | "losers";

export function MarketOverview() {
  const movers = useLiveData<MoversPayload>("/api/movers", MOVERS_REFRESH_MS);
  const board = useMemo(() => resolveMoversBoard(movers.data), [movers.data]);
  const gainers = board.gainers.slice(0, BOARD_SIZE);
  const losers = board.losers.slice(0, BOARD_SIZE);
  const feed = [...gainers, ...losers];
  const usingFallback = board.source === "fallback" || Boolean(movers.error);
  const sessionLabel = board.lastSession || usingFallback ? "LAST SESSION" : "LIVE";
  const [mobileBoard, setMobileBoard] = useState<BoardTab>("gainers");

  return (
    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
        <p className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          {sessionLabel}
          {board.marketState ? ` · ${board.marketState}` : ""}
        </p>
        <button
          type="button"
          onClick={() => movers.refresh()}
          className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-white/15 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-300 hover:border-gain/40 hover:text-gain"
        >
          {movers.loading ? "Scanning…" : "Refresh"}
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Bursa movers"
        className="grid grid-cols-2 border-b border-white/10 md:hidden"
      >
        <BoardTabButton
          label="Top Gainers"
          selected={mobileBoard === "gainers"}
          tone="gain"
          onSelect={() => setMobileBoard("gainers")}
        />
        <BoardTabButton
          label="Top Losers"
          selected={mobileBoard === "losers"}
          tone="loss"
          onSelect={() => setMobileBoard("losers")}
        />
      </div>

      <div className="grid w-full max-w-full grid-cols-1 gap-4 overflow-x-hidden md:grid-cols-2">
        <div
          role="tabpanel"
          className={`min-w-0 w-full max-w-full overflow-hidden ${
            mobileBoard === "gainers" ? "block" : "hidden md:block"
          }`}
        >
          <MoversColumn
            title="Top gainers"
            rows={gainers}
            loading={movers.loading}
            tone="gain"
          />
        </div>
        <div
          role="tabpanel"
          className={`min-w-0 w-full max-w-full overflow-hidden ${
            mobileBoard === "losers" ? "block" : "hidden md:block"
          }`}
        >
          <MoversColumn
            title="Top losers"
            rows={losers}
            loading={movers.loading}
            tone="loss"
          />
        </div>
      </div>

      <MoversFeed rows={feed} onRetry={movers.refresh} reconnecting={movers.loading} />
    </div>
  );
}

function BoardTabButton({
  label,
  selected,
  tone,
  onSelect,
}: {
  label: string;
  selected: boolean;
  tone: "gain" | "loss";
  onSelect: () => void;
}) {
  const active = tone === "gain" ? "border-gain text-gain" : "border-loss text-loss";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`min-h-11 border-b-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        selected ? active : "border-transparent text-neutral-500"
      }`}
    >
      {label}
    </button>
  );
}

function pctPill(changePct: number | null) {
  const up = (changePct ?? 0) >= 0;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
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
    <div className="min-w-0 w-full max-w-full overflow-hidden">
      <h3
        className={`hidden px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] sm:px-4 md:block ${
          tone === "gain" ? "text-gain" : "text-loss"
        }`}
      >
        {title}
      </h3>
      <ul className="divide-y divide-white/5">
        {loading && rows.length === 0
          ? Array.from({ length: 5 }, (_, index) => <MoverRowSkeleton key={index} />)
          : rows.map((row, index) => (
          <li key={row.symbol} className="min-w-0">
            <Link
              href={terminalHref(row.symbol)}
              className="flex min-w-0 items-center justify-between px-3 py-2.5 hover:bg-white/[0.03]"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
                <span className="w-4 shrink-0 font-mono text-[10px] text-neutral-600">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-neutral-100">
                    {row.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-neutral-600">
                    {row.code} · VOL {displayVolume(row.quote.volume)}
                  </span>
                </span>
              </span>
              <span className="flex flex-shrink-0 items-center justify-end gap-2 text-right">
                <span className="whitespace-nowrap font-mono text-xs text-white sm:text-sm">
                  RM {formatPrice(row.quote.price)}
                </span>
                {pctPill(row.quote.changePct)}
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && !loading ? (
          <li className="px-3 py-8 text-center font-mono text-[10px] text-neutral-600 sm:px-4">
            NO MOVES
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
    <div className="min-w-0 overflow-x-hidden border-t border-white/10">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          Movers feed
        </h3>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500 hover:text-gain"
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
                <span className="whitespace-nowrap font-mono text-[11px] text-white">
                  RM {formatPrice(row.quote.price)}
                </span>
                <span
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
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
