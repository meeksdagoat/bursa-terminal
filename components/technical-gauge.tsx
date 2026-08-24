"use client";

import { useEffect, useMemo, useState } from "react";
import type { CandlesPayload } from "@/lib/types";
import {
  ACTION_LABEL,
  RATING_LABEL,
  summariseTechnicals,
  type TechnicalAction,
  type TechnicalSummary,
} from "@/lib/technicals";
import { useLiveData } from "@/lib/use-live-data";

const REFRESH_MS = 60 * 1000;

const RATING_COLOR: Record<TechnicalAction, string> = {
  "strong-sell": "#f23645",
  sell: "#f77c80",
  neutral: "#ffb74a",
  buy: "#89c74a",
  "strong-buy": "#089981",
};

const ARC_SEGMENTS = [
  { color: "#f23645", start: 180, end: 144 },
  { color: "#f77c80", start: 144, end: 108 },
  { color: "#787b86", start: 108, end: 72 },
  { color: "#89c74a", start: 72, end: 36 },
  { color: "#089981", start: 36, end: 0 },
];

/** Gray arc is the middle 36° of the semicircle (−18°…+18°). */
const GRAY_ARC = 18;

function scoreToNeedleAngle(score: number): number {
  return Math.max(-1, Math.min(1, score)) * 90;
}

function ratingFromNeedleAngle(degrees: number): TechnicalAction {
  if (degrees <= -54) return "strong-sell";
  if (degrees < -GRAY_ARC) return "sell";
  if (degrees >= 54) return "strong-buy";
  if (degrees > GRAY_ARC) return "buy";
  return "neutral";
}

type TechnicalGaugeProps = {
  symbol: string;
  companyName: string;
};

export function TechnicalGauge({ symbol, companyName }: TechnicalGaugeProps) {
  const [open, setOpen] = useState(false);
  const url = `/api/candles?symbol=${encodeURIComponent(symbol)}&range=1Y`;
  const { data, error, loading } = useLiveData<CandlesPayload>(url, REFRESH_MS);

  const ready = data?.symbol === symbol;
  const summary = useMemo(() => {
    if (!ready || !data) return null;
    return summariseTechnicals(data.candles);
  }, [data, ready]);
  const pending = !ready || (loading && !summary);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 md:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]">
        <GaugeDial
          summary={summary}
          loading={pending}
          error={ready ? error : null}
          companyName={companyName}
        />

        <div className="flex min-w-0 flex-col justify-center gap-3">
          <VoteBar
            title="Oscillators"
            hint="RSI · Stochastic · MACD"
            counts={summary?.oscillators ?? { sell: 0, neutral: 0, buy: 0 }}
            loading={!summary}
          />
          <VoteBar
            title="Moving Averages"
            hint="EMA / SMA"
            counts={summary?.movingAverages ?? { sell: 0, neutral: 0, buy: 0 }}
            loading={!summary}
          />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="self-start min-h-11 rounded-sm border border-line px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400 hover:border-amber-400/40 hover:text-amber-300 md:min-h-0 md:px-2 md:py-1 md:text-[9px]"
          >
            {open ? "Hide Technicals" : "More Technicals"}
          </button>
        </div>
      </div>

      {open ? <BreakdownTable summary={summary} loading={!ready && loading} /> : null}
    </div>
  );
}

function GaugeDial({
  summary,
  loading,
  error,
  companyName,
}: {
  summary: TechnicalSummary | null;
  loading: boolean;
  error: string | null;
  companyName: string;
}) {
  const [angle, setAngle] = useState(0);
  const targetAngle = summary ? scoreToNeedleAngle(summary.score) : 0;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAngle(targetAngle));
    return () => cancelAnimationFrame(frame);
  }, [targetAngle]);

  const rating = ratingFromNeedleAngle(targetAngle);
  const cx = 100;
  const cy = 108;
  const radius = 78;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 200 138" className="h-[132px] w-[200px]" role="img" aria-label="Technical summary gauge">
        {ARC_SEGMENTS.map((segment) => (
          <path
            key={segment.color}
            d={arcPath(cx, cy, radius, segment.start, segment.end)}
            fill="none"
            stroke={segment.color}
            strokeWidth="14"
            strokeLinecap="butt"
          />
        ))}

        <Needle cx={cx} cy={cy} angle={angle} />

        <circle cx={cx} cy={cy} r="6" fill="#e5e5e5" />
        <circle cx={cx} cy={cy} r="3" fill="#0a0a0a" />

        <text x="18" y="128" fill="#f23645" fontSize="7" fontFamily="ui-monospace, monospace">
          STRONG SELL
        </text>
        <text x="152" y="128" fill="#089981" fontSize="7" fontFamily="ui-monospace, monospace">
          STRONG BUY
        </text>
      </svg>

      <p
        className="mt-1 text-center text-[18px] font-semibold tracking-[0.08em]"
        style={{ color: RATING_COLOR[rating] }}
      >
        {loading ? "…" : error ? "UNAVAILABLE" : summary ? RATING_LABEL[rating] : "NO DATA"}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
        {companyName}
      </p>
    </div>
  );
}

function Needle({ cx, cy, angle }: { cx: number; cy: number; angle: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <polygon
        className="tech-needle"
        points="0,-64 -5.5,0 5.5,0"
        fill="#e8e8e8"
        style={{ transform: `rotate(${angle}deg)` }}
      />
    </g>
  );
}

function VoteBar({
  title,
  hint,
  counts,
  loading,
}: {
  title: string;
  hint: string;
  counts: { sell: number; neutral: number; buy: number };
  loading: boolean;
}) {
  const total = Math.max(1, counts.sell + counts.neutral + counts.buy);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-200">{title}</h3>
        <span className="font-mono text-[9px] text-neutral-600">{hint}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-sm bg-[#1a1a1a]">
        {loading ? (
          <span className="w-full bg-[#2a2a2a]" />
        ) : (
          <>
            <span className="bg-[#f23645]" style={{ width: `${(counts.sell / total) * 100}%` }} />
            <span className="bg-[#787b86]" style={{ width: `${(counts.neutral / total) * 100}%` }} />
            <span className="bg-[#089981]" style={{ width: `${(counts.buy / total) * 100}%` }} />
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-neutral-500">
        <span className="text-[#f77c80]">Sell {loading ? "—" : counts.sell}</span>
        <span>Neutral {loading ? "—" : counts.neutral}</span>
        <span className="text-[#89c74a]">Buy {loading ? "—" : counts.buy}</span>
      </div>
    </div>
  );
}

function BreakdownTable({
  summary,
  loading,
}: {
  summary: TechnicalSummary | null;
  loading: boolean;
}) {
  const rows = summary?.rows ?? [];

  return (
    <div className="border-t border-line">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line bg-[#161616] font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            <th className="px-3 py-1.5 font-medium">Indicator</th>
            <th className="px-3 py-1.5 font-medium">Value</th>
            <th className="px-3 py-1.5 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-1.5 text-[12px] text-neutral-200">{row.label}</td>
              <td className="px-3 py-1.5 font-mono text-[12px] text-neutral-100">{row.display}</td>
              <td
                className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ${
                  row.action === "buy"
                    ? "text-gain"
                    : row.action === "sell"
                      ? "text-loss"
                      : "text-neutral-400"
                }`}
              >
                {ACTION_LABEL[row.action]}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-3 font-mono text-[10px] text-neutral-600">
                {loading ? "COMPUTING INDICATORS…" : "NOT ENOUGH DAILY HISTORY"}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}
