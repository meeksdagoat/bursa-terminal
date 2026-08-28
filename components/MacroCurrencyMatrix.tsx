"use client";

import { changeClass, formatFx, formatPct, formatPrice } from "@/lib/format";
import {
  geCardShell,
  geMeta,
  gePrimaryMetric,
  geSectionHeader,
  geSectionShell,
  geSectionSubheader,
} from "@/lib/global-economy-ui";
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
    <section className="flex h-auto min-w-0 flex-col overflow-hidden border border-neutral-800 bg-[#0d0d0d] lg:h-full lg:min-h-0">
      <header className={geSectionShell}>
        <h3 className={geSectionHeader}>Currency & Commodity</h3>
        <p className={geSectionSubheader}>DXY · USD/MYR · FCPO · MGS–UST spread</p>
      </header>

      <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
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
    <article className={`${geCardShell} bg-[#0d0d0d]`}>
      <div className="flex min-w-0 items-start justify-between gap-1.5">
        <p className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          {label}
        </p>
        {change != null ? (
          <span className={`shrink-0 font-mono text-[9px] leading-tight ${changeTone}`}>
            {formatPct(change)}
          </span>
        ) : null}
      </div>
      <p className={`mt-0.5 ${gePrimaryMetric} ${valueClass}`}>{value}</p>
      <p className={`mt-0.5 ${geMeta} uppercase tracking-wider`}>{subvalue ?? hint}</p>
      {subvalue ? <p className={`mt-0.5 ${geMeta} text-[9px] text-zinc-500`}>{hint}</p> : null}
    </article>
  );
}
