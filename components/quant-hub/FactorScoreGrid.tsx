"use client";

import { useCallback } from "react";
import type { QuantFactorSignal } from "@/lib/quant/types";
import { assessOverviewFactorRelevance, formatFactorTargetCategories } from "@/lib/quant/sector-relevance";
import { useSymbolFactorScores } from "@/lib/use-symbol-factors";
import { entryBySymbol } from "@/lib/universe";
import { useRegisterQuantExport } from "@/components/quant-hub/QuantExportContext";
import { buildFactorMatrixExport } from "@/lib/quant/export-datasets";

type FactorScoreGridProps = {
  factors: QuantFactorSignal[];
  targetSymbol: string;
  targetSector?: string;
  loading: boolean;
};

function scoreTone(score: number, muted: boolean): string {
  if (muted) return "text-neutral-500";
  if (score >= 35) return "text-gain";
  if (score <= -35) return "text-loss";
  return "text-amber-400";
}

function barTone(score: number, muted: boolean): string {
  if (muted) return "bg-neutral-600";
  if (score >= 35) return "bg-gain";
  if (score <= -35) return "bg-loss";
  return "bg-amber-400";
}

function statusBadge(status: QuantFactorSignal["status"]): string {
  if (status === "live") return "text-gain";
  if (status === "degraded") return "text-amber-400";
  return "text-neutral-500";
}

export function FactorScoreGrid({
  factors: fallbackFactors,
  targetSymbol,
  targetSector: sectorProp,
  loading: hubLoading,
}: FactorScoreGridProps) {
  const entry = entryBySymbol(targetSymbol);
  const targetSector = sectorProp ?? entry?.sector ?? "Unknown";
  const targetLabel = entry?.shortName ?? targetSymbol;

  const { factors, loading, recalculating, error } = useSymbolFactorScores(
    targetSymbol,
    fallbackFactors,
    hubLoading,
  );

  const getExportPayload = useCallback(
    () => buildFactorMatrixExport({ symbol: targetSymbol, factors }),
    [factors, targetSymbol],
  );

  useRegisterQuantExport(getExportPayload, factors.length === 0);

  if (loading && factors.length === 0) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded border border-neutral-800 bg-[#111111]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {recalculating ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded bg-[#0d0d0d]/55 backdrop-blur-[1px]"
          aria-hidden
        />
      ) : null}

      {recalculating ? (
        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] text-amber-400/90">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-amber-400/30 border-t-amber-400" />
          Recalculating factor scores for {targetLabel} · {targetSector}
        </p>
      ) : (
        <p className="mb-2 font-mono text-[10px] text-neutral-600">
          Target {targetLabel} · {targetSector}
        </p>
      )}

      {error ? (
        <p className="mb-2 rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      <div
        className={`grid gap-2 transition-opacity duration-300 sm:grid-cols-2 xl:grid-cols-3 ${
          recalculating ? "opacity-60" : "opacity-100"
        }`}
      >
        {factors.map((factor) => {
          const barWidth = Math.abs(factor.score) / 2;
          const relevance = assessOverviewFactorRelevance(factor.id, targetSector);
          const sectorMuted = factor.metadata.sectorMuted != null || relevance.level === "low";
          const displayScore = sectorMuted ? 0 : factor.score;

          return (
            <article
              key={factor.id}
              className="flex flex-col gap-2 rounded border border-neutral-800 bg-[#0d0d0d] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-300">
                    {factor.label}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{factor.summary}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-[18px] font-semibold tabular-nums ${scoreTone(displayScore, sectorMuted)}`}
                  >
                    {displayScore > 0 ? "+" : ""}
                    {displayScore}
                  </p>
                  <p
                    className={`font-mono text-[9px] uppercase tracking-[0.12em] ${statusBadge(factor.status)}`}
                  >
                    {factor.status}
                  </p>
                </div>
              </div>

              {relevance.message ? (
                <p className="rounded border border-sky-400/25 bg-sky-400/5 px-2 py-1 font-mono text-[9px] text-sky-300">
                  {relevance.message}
                </p>
              ) : null}

              <div className="relative h-2 overflow-hidden rounded bg-[#161616]">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-neutral-700" />
                {displayScore >= 0 ? (
                  <div
                    className={`absolute left-1/2 top-0 h-full ${barTone(displayScore, sectorMuted)} opacity-80 transition-all duration-500`}
                    style={{ width: `${barWidth}%` }}
                  />
                ) : (
                  <div
                    className={`absolute right-1/2 top-0 h-full ${barTone(displayScore, sectorMuted)} opacity-80 transition-all duration-500`}
                    style={{ width: `${barWidth}%` }}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-neutral-600">
                <span>Conf {factor.confidence}%</span>
                <span>{formatFactorTargetCategories(factor.id)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
