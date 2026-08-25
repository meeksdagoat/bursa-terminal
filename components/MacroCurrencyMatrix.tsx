"use client";

import { changeClass, formatFx, formatPct, formatPrice } from "@/lib/format";
import type { BnmPayload, CommodityQuote, GlobalMarketQuote } from "@/lib/types";

type MacroCurrencyMatrixProps = {
  markets: GlobalMarketQuote[];
  bnm: BnmPayload | null;
  cpo: CommodityQuote | null;
};

function findMarket(markets: GlobalMarketQuote[], id: string): GlobalMarketQuote | null {
  return markets.find((item) => item.id === id) ?? null;
}

function toneClass(value: number | null | undefined, invert = false): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "text-neutral-400";
  const headwind = invert ? value > 0 : value < 0;
  return headwind ? "text-rose-400" : "text-emerald-400";
}

export function MacroCurrencyMatrix({ markets, bnm, cpo }: MacroCurrencyMatrixProps) {
  const dxy = findMarket(markets, "dxy");
  const us10y = findMarket(markets, "us10y");
  const mgs10y = findMarket(markets, "mgs10y");
  const usdcny = findMarket(markets, "usdcny");
  const usdMyr = bnm?.rates.find((rate) => rate.pair === "USD/MYR") ?? null;
  const cnyMyr = bnm?.rates.find((rate) => rate.pair === "CNY/MYR") ?? null;

  const usdCny =
    usdcny?.price ??
    (usdMyr?.rate != null && cnyMyr?.rate != null && cnyMyr.rate !== 0
      ? usdMyr.rate / cnyMyr.rate
      : null);

  const spreadBps =
    mgs10y?.price != null && us10y?.price != null
      ? Math.round((mgs10y.price - us10y.price) * 100)
      : null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
      <header className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
          Currency & Commodity
        </h3>
        <p className="mt-0.5 text-[10px] text-neutral-500">DXY · USD/MYR · FCPO · MGS–UST spread</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-px bg-neutral-800">
        <MatrixCard
          label="US Dollar Index"
          hint="TVC:DXY · greenback strength"
          value={dxy?.price != null ? dxy.price.toFixed(2) : "—"}
          change={dxy?.changePct ?? null}
          changeTone={toneClass(dxy?.changePct, true)}
        />
        <MatrixCard
          label="USD crosses"
          hint="BNM USD/MYR · USD/CNY"
          value={formatFx(usdMyr?.rate)}
          subvalue={usdCny != null ? `CNY ${formatFx(usdCny)}` : "CNY —"}
          change={usdMyr?.changePct ?? null}
          changeTone={toneClass(usdMyr?.changePct, true)}
        />
        <MatrixCard
          label="Crude Palm Oil"
          hint={`${cpo?.source === "bmd-fcpo" ? "BMD FCPO" : "CPO"} · plantation beta`}
          value={cpo?.price != null ? formatPrice(cpo.price) : "—"}
          subvalue={cpo?.unit ?? "MYR/t"}
          change={cpo?.changePct ?? null}
          changeTone={changeClass(cpo?.changePct)}
        />
        <MatrixCard
          label="MGS–UST 10Y"
          hint="Sovereign spread · capital flow"
          value={spreadBps == null ? "—" : `${spreadBps > 0 ? "+" : ""}${spreadBps}bp`}
          subvalue={`MGS ${mgs10y?.price?.toFixed(2) ?? "—"}% · UST ${us10y?.price?.toFixed(2) ?? "—"}%`}
          change={null}
          changeTone={spreadBps == null ? "text-neutral-400" : spreadBps >= 0 ? "text-emerald-400" : "text-rose-400"}
          valueClass={spreadBps == null ? "text-neutral-400" : spreadBps >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        </div>
      </div>
    </section>
  );
}

function MatrixCard({
  label,
  hint,
  value,
  subvalue,
  change,
  changeTone,
  valueClass = "text-neutral-100",
}: {
  label: string;
  hint: string;
  value: string;
  subvalue?: string;
  change: number | null;
  changeTone: string;
  valueClass?: string;
}) {
  return (
    <article className="bg-[#0d0d0d] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</p>
        {change != null ? (
          <span className={`font-mono text-[9px] ${changeTone}`}>{formatPct(change)}</span>
        ) : null}
      </div>
      <p className={`mt-1 font-mono text-[18px] leading-none ${valueClass}`}>{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-neutral-600">{subvalue ?? hint}</p>
      {subvalue ? (
        <p className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-neutral-700">{hint}</p>
      ) : null}
    </article>
  );
}
