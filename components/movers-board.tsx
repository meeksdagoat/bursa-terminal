"use client";

import Link from "next/link";
import { changeClass, formatPct, formatPrice, formatVolume } from "@/lib/format";
import type { MoverRow, MoversPayload } from "@/lib/types";

type MoversBoardProps = {
  payload: MoversPayload | null;
  error: string | null;
  loading: boolean;
  /** Rows per board; the overview shows six of each. */
  size?: number;
};

export function MoversBoard({ payload, error, loading, size = 6 }: MoversBoardProps) {
  const breadth = payload?.breadth ?? null;

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
          {breadth ? (
            <>
              <span className="text-gain">{breadth.advancers} UP</span>
              <span className="text-loss">{breadth.decliners} DOWN</span>
              <span className="text-neutral-500">{breadth.unchanged} FLAT</span>
              <span className="text-neutral-600">
                {breadth.covered}/{breadth.universe} TRADED
              </span>
            </>
          ) : null}
          <span className={error ? "text-loss" : "text-neutral-600"}>
            {error ? "FEED ERROR" : loading ? "LOADING" : `YAHOO · ${payload?.marketState ?? "—"}`}
          </span>
          <Link
            href="/terminal"
            className="border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-gain hover:bg-gain/10"
          >
            Open Bursa MY
          </Link>
        </div>
      </div>

      {error ? (
        <p className="px-3 py-6 text-center font-mono text-[11px] text-loss">
          MOVERS FEED UNAVAILABLE · {error}
        </p>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <Board
            title="Top Gainers"
            rows={payload?.gainers ?? []}
            loading={loading}
            size={size}
            tone="gain"
          />
          <Board
            title="Top Losers"
            rows={payload?.losers ?? []}
            loading={loading}
            size={size}
            tone="loss"
          />
        </div>
      )}
    </section>
  );
}

function Board({
  title,
  rows,
  loading,
  size,
  tone,
}: {
  title: string;
  rows: MoverRow[];
  loading: boolean;
  size: number;
  tone: "gain" | "loss";
}) {
  const visible = rows.slice(0, size);

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
        <span className="font-mono text-[9px] text-neutral-600">TOP {size}</span>
      </div>

      <ul className="divide-y divide-line">
        {visible.map((row, position) => (
          <li key={row.symbol} className="relative hover:bg-[#161616]">
            <Link
              href={`/terminal?symbol=${encodeURIComponent(row.symbol)}`}
              title={`Open ${row.name} in the market terminal`}
              className="flex items-center gap-3 px-3 py-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-gain/60"
            >
              <span className="w-3 shrink-0 font-mono text-[10px] text-neutral-700">
                {position + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-100">{row.name}</p>
                <p className="font-mono text-[9px] text-neutral-600">
                  {row.symbol} · {row.sector} · VOL {formatVolume(row.quote.volume)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-[13px] text-neutral-100">
                  {formatPrice(row.quote.price)}
                </p>
                <p className={`font-mono text-[11px] ${changeClass(row.quote.changePct)}`}>
                  {formatPct(row.quote.changePct)}
                </p>
              </div>
            </Link>
          </li>
        ))}

        {visible.length === 0 ? (
          <li className="px-3 py-6 text-center font-mono text-[10px] text-neutral-600">
            {loading ? "SCANNING THE UNIVERSE…" : "NO QUALIFYING MOVES THIS SESSION"}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
