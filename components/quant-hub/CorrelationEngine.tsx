"use client";

import { useEffect, useMemo, useState } from "react";
import { DualAxisChart } from "@/components/quant-hub/DualAxisChart";
import { TargetSymbolCombobox } from "@/components/quant-hub/TargetSymbolCombobox";
import { formatStockPriceLabel } from "@/lib/stock-names";
import { assessSeriesFactorRelevance } from "@/lib/quant/sector-relevance";
import type {
  QuantCorrelationPayload,
  QuantFactorOption,
  QuantSeriesFactorId,
} from "@/lib/quant/types";
import { entryBySymbol } from "@/lib/universe";

type CorrelationWindowDays = 30 | 60 | 90;

type CorrelationEngineProps = {
  factorOptions: QuantFactorOption[];
  symbol: string;
  onSymbolChange: (symbol: string) => void;
};

function correlationTone(value: number | null): string {
  if (value == null) return "text-neutral-500";
  if (value >= 0.35) return "text-gain";
  if (value <= -0.35) return "text-loss";
  return "text-amber-400";
}

export function CorrelationEngine({ factorOptions, symbol, onSymbolChange }: CorrelationEngineProps) {
  const [factorId, setFactorId] = useState<QuantSeriesFactorId>("rainfall");
  const [windowDays, setWindowDays] = useState<CorrelationWindowDays>(30);
  const [payload, setPayload] = useState<QuantCorrelationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetSector = entryBySymbol(symbol)?.sector ?? "Unknown";
  const sectorRelevance = useMemo(
    () => assessSeriesFactorRelevance(factorId, targetSector),
    [factorId, targetSector],
  );

  const url = useMemo(
    () =>
      `/api/quant-hub/correlation?factor=${encodeURIComponent(factorId)}&symbol=${encodeURIComponent(symbol)}&window=${windowDays}`,
    [factorId, symbol, windowDays],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const response = await fetch(url);
        const body: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : `Request failed (${response.status})`;
          throw new Error(message);
        }
        if (cancelled) return;
        setPayload(body as QuantCorrelationPayload);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Correlation request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const selectedFactor = factorOptions.find((option) => option.id === factorId);
  const relevanceMessage = payload?.sectorRelevance.message ?? sectorRelevance.message;
  const isWeatherFactor = factorId === "rainfall" || factorId === "temperature";
  const alignedDays = payload?.alignedTradingDays ?? 0;
  const insufficientSample = alignedDays > 0 && alignedDays < 60;
  const partialSampleNote =
    alignedDays >= 60 && alignedDays < 90
      ? `Calculated on ${alignedDays} aligned trading days`
      : null;

  return (
    <section className="flex min-h-0 flex-col gap-3 rounded border border-neutral-800 bg-[#0d0d0d] p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Correlation Engine
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Rolling Pearson r between live Open-Meteo data and target daily returns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([30, 60, 90] as const).map((window) => (
            <button
              key={window}
              type="button"
              onClick={() => setWindowDays(window)}
              className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                windowDays === window
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                  : "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              {window}D
            </button>
          ))}
          {payload?.pearsonR != null ? (
            <span className="font-mono text-[10px] text-neutral-500">
              Active window r ={" "}
              <span className={correlationTone(payload.pearsonR)}>{payload.pearsonR.toFixed(3)}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Factor A
          </span>
          <select
            value={factorId}
            onChange={(event) => setFactorId(event.target.value as QuantSeriesFactorId)}
            className="rounded border border-neutral-800 bg-[#111111] px-2 py-2 font-mono text-[11px] text-neutral-200 outline-none focus:border-amber-400/40"
          >
            {factorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.unit})
              </option>
            ))}
          </select>
          {selectedFactor ? (
            <span className="text-[10px] text-neutral-600">{selectedFactor.blurb}</span>
          ) : null}
        </label>

        <div className="relative flex flex-col gap-1 overflow-visible">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
            Target Symbol B
          </span>
          <TargetSymbolCombobox value={symbol} onChange={onSymbolChange} />
          <span className="text-[10px] text-neutral-600">Sector: {targetSector}</span>
        </div>
      </div>

      {relevanceMessage ? (
        <p className="rounded border border-sky-400/25 bg-sky-400/5 px-2 py-1 font-mono text-[10px] text-sky-300">
          {relevanceMessage}
        </p>
      ) : null}

      {isWeatherFactor && payload?.status ? (
        <p className="font-mono text-[9px] text-neutral-600">
          Weather feed: `/api/quant/weather` · Open-Meteo archive + forecast · {payload.status}
          {alignedDays > 0
            ? partialSampleNote
              ? ` · ${partialSampleNote}`
              : ` · ${alignedDays} aligned trading days`
            : ""}
        </p>
      ) : partialSampleNote ? (
        <p className="font-mono text-[9px] text-neutral-600">{partialSampleNote}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          label="Pearson r (30D)"
          value={payload?.pearsonR30 ?? null}
          format={(value) => value.toFixed(3)}
        />
        <MetricCard
          label="Pearson r (60D)"
          value={payload?.pearsonR60 ?? null}
          format={(value) => value.toFixed(3)}
        />
        <MetricCard
          label="Pearson r (90D)"
          value={payload?.pearsonR90 ?? null}
          format={(value) => value.toFixed(3)}
        />
      </div>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {insufficientSample && payload?.errors.length ? (
        <p className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1 font-mono text-[10px] text-amber-400">
          {payload.errors.slice(0, 2).join(" · ")}
        </p>
      ) : null}

      <DualAxisChart
        points={payload?.points ?? []}
        factorLabel={payload?.factorLabel ?? selectedFactor?.label ?? "Factor"}
        factorUnit={payload?.factorUnit ?? selectedFactor?.unit ?? ""}
        priceSeriesLabel={
          payload?.priceSeriesLabel ?? formatStockPriceLabel(payload?.symbol ?? symbol)
        }
        loading={loading}
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null;
  format: (value: number) => string;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-[#111111] px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-[16px] tabular-nums ${correlationTone(value)}`}>
        {value == null ? "—" : format(value)}
      </p>
    </div>
  );
}
