"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SignedPct } from "@/components/signed-change";
import { CountPulse, MoverRowSkeleton } from "@/components/skeleton";
import { formatPrice, formatVolume } from "@/lib/format";

function displayVolume(volume: number | null) {
  return volume != null && volume > 0 ? formatVolume(volume) : "—";
}
import { resolveMoversBoard } from "@/lib/movers-fallback";
import type { MoverRow, MoversPayload } from "@/lib/types";

type MoversBoardProps = {
  payload: MoversPayload | null;
  error: string | null;
  loading: boolean;
  /** Rows per board; the overview shows six of each. */
  size?: number;
  onRetry?: () => void;
};

export function MoversBoard({ payload, error, loading, size = 6, onRetry }: MoversBoardProps) {
  const board = useMemo(() => resolveMoversBoard(payload), [payload]);
  const gainers = board.gainers.slice(0, size);
  const losers = board.losers.slice(0, size);
  const feed = [...gainers, ...losers];
  const breadth = board.breadth;
  const usingFallback = board.source === "fallback" || Boolean(error);

  return (
    <section className="border-b border-line bg-terminal">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Bursa Movers
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Preview of today&apos;s top six gainers and losers · live Yahoo quotes
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-gain">{breadth.advancers} UP</span>
          <span className="text-loss">{breadth.decliners} DOWN</span>
          <span className="text-neutral-500">{breadth.unchanged} FLAT</span>
          <span className="text-neutral-600">
            {breadth.covered}/{breadth.universe} TRADED
          </span>
          <span className={error ? "text-loss" : "text-neutral-600"}>
            {usingFallback ? "LAST SESSION" : loading ? <CountPulse /> : `YAHOO · ${board.marketState ?? "—"}`}
          </span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-300 hover:text-gain md:min-h-0"
            >
              Retry
            </button>
          ) : null}
          <Link
            href="/terminal"
            className="inline-flex min-h-11 items-center border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-gain hover:bg-gain/10 md:min-h-0"
          >
            Open Bursa MY
          </Link>
        </div>
      </div>

      <div className="grid w-full max-w-full grid-cols-1 divide-y divide-line overflow-hidden md:grid-cols-2 md:divide-x md:divide-y-0 lg:divide-x">
        <Board title="Top Gainers" rows={gainers} loading={loading} tone="gain" />
        <Board title="Top Losers" rows={losers} loading={loading} tone="loss" />
      </div>

      <MoversTape rows={feed} onRetry={onRetry} reconnecting={loading} />
    </section>
  );
}

function Board({
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
    <div className="min-w-0">
      <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-1.5">
        <h3
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
            tone === "gain" ? "text-gain" : "text-loss"
          }`}
        >
          {title}
        </h3>
        <span className="font-mono text-[9px] text-neutral-600">TOP {rows.length || "—"}</span>
      </div>

      <ul className="divide-y divide-line">
        {loading && rows.length === 0
          ? Array.from({ length: 6 }, (_, index) => <MoverRowSkeleton key={index} />)
          : rows.map((row, position) => {
          const up = (row.quote.changePct ?? 0) >= 0;
          return (
            <li key={row.symbol} className="relative hover:bg-[#161616]">
              <Link
                href={`/terminal?symbol=${encodeURIComponent(row.symbol)}`}
                title={`Open ${row.name} in the market terminal`}
                className="flex min-w-0 items-center gap-3 px-3 py-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
              >
                <span className="w-3 shrink-0 font-mono text-[10px] text-neutral-700">
                  {position + 1}
                </span>

                <div className="min-w-0 flex-1 pr-2">
                  <p className="truncate text-[13px] font-medium text-neutral-100">{row.name}</p>
                  <p className="truncate font-mono text-[9px] text-neutral-600">
                    {row.code} · {row.sector} · VOL {displayVolume(row.quote.volume)}
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center justify-end gap-2 text-right">
                  <p className="font-mono text-[13px] text-neutral-100">
                    RM {formatPrice(row.quote.price)}
                  </p>
                  <span
                    className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 ${
                      up ? "bg-emerald-400/15" : "bg-rose-400/15"
                    }`}
                  >
                    <SignedPct value={row.quote.changePct} className="text-[10px] font-semibold" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}

        {!loading && rows.length === 0 ? (
          <li className="px-3 py-6 text-center font-mono text-[10px] text-neutral-600">
            NO QUALIFYING MOVES THIS SESSION
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function MoversTape({
  rows,
  onRetry,
  reconnecting,
}: {
  rows: MoverRow[];
  onRetry?: () => void;
  reconnecting: boolean;
}) {
  const tape = [...rows, ...rows];

  return (
    <div className="border-t border-line">
      <div className="flex items-center justify-between px-3 py-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Movers feed
        </h3>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500 hover:text-gain"
          >
            {reconnecting ? "Reconnecting…" : "Reconnect"}
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden border-t border-line py-1.5">
        <div className="tape-track flex">
          {tape.map((row, index) => {
            const up = (row.quote.changePct ?? 0) >= 0;
            return (
              <Link
                key={`${row.symbol}-${index}`}
                href={`/terminal?symbol=${encodeURIComponent(row.symbol)}`}
                className="flex shrink-0 items-center gap-2 px-3"
              >
                <span className="font-mono text-[10px] text-neutral-500">{row.code}</span>
                <span className="font-mono text-[11px] text-neutral-100">
                  RM {formatPrice(row.quote.price)}
                </span>
                <span
                  className={`inline-flex rounded-full px-1.5 py-0.5 ${
                    up ? "bg-emerald-400/15" : "bg-rose-400/15"
                  }`}
                >
                  <SignedPct value={row.quote.changePct} className="text-[9px]" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
