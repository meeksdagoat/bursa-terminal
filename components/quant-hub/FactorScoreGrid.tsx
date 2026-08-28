"use client";



import type { QuantFactorSignal } from "@/lib/quant/types";

import { assessOverviewFactorRelevance, formatFactorTargetCategories } from "@/lib/quant/sector-relevance";

import { entryBySymbol } from "@/lib/universe";



type FactorScoreGridProps = {

  factors: QuantFactorSignal[];

  targetSymbol: string;

  loading: boolean;

};



function scoreTone(score: number): string {

  if (score >= 35) return "text-gain";

  if (score <= -35) return "text-loss";

  return "text-amber-400";

}



function barTone(score: number): string {

  if (score >= 35) return "bg-gain";

  if (score <= -35) return "bg-loss";

  return "bg-amber-400";

}



function statusBadge(status: QuantFactorSignal["status"]): string {

  if (status === "live") return "text-gain";

  if (status === "degraded") return "text-amber-400";

  return "text-neutral-500";

}



export function FactorScoreGrid({ factors, targetSymbol, loading }: FactorScoreGridProps) {

  const targetSector = entryBySymbol(targetSymbol)?.sector ?? "Unknown";



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

    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">

      {factors.map((factor) => {

        const barWidth = Math.abs(factor.score) / 2;

        const relevance = assessOverviewFactorRelevance(factor.id, targetSector);



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

                <p className={`font-mono text-[18px] font-semibold tabular-nums ${scoreTone(factor.score)}`}>

                  {factor.score > 0 ? "+" : ""}

                  {factor.score}

                </p>

                <p className={`font-mono text-[9px] uppercase tracking-[0.12em] ${statusBadge(factor.status)}`}>

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

              {factor.score >= 0 ? (

                <div

                  className={`absolute left-1/2 top-0 h-full ${barTone(factor.score)} opacity-80`}

                  style={{ width: `${barWidth}%` }}

                />

              ) : (

                <div

                  className={`absolute right-1/2 top-0 h-full ${barTone(factor.score)} opacity-80`}

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

  );

}


