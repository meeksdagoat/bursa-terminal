import "server-only";

import { UNIT_TRUST_CATALOG } from "@/lib/unit-trust/catalog";
import { fetchFimmDailyPrices, resolveFimmNav, type FimmPriceBook } from "@/lib/unit-trust/fimm-prices";
import type {
  UnitTrustApiPayload,
  UnitTrustFund,
  UnitTrustHistoryPoint,
} from "@/lib/unit-trust/types";
import type { UnitTrustCatalogEntry } from "@/lib/unit-trust/catalog";

function yieldFromSen(nav: number, sen: number | null): number | null {
  if (sen == null || nav <= 0) return null;
  return (sen / (nav * 100)) * 100;
}

function totalReturnPct(priceType: "Fixed" | "Variable", navGrowthPct: number, distributionSen: number, nav: number): number {
  if (priceType === "Fixed") return distributionSen;
  const distYield = yieldFromSen(nav, distributionSen) ?? 0;
  return navGrowthPct + distYield;
}

function buildHistory(
  entry: UnitTrustCatalogEntry,
  currentNav: number,
): UnitTrustHistoryPoint[] {
  const endYear = new Date().getFullYear();
  const dists = [...entry.distributionSen];
  const growth = entry.navGrowthPct ? [...entry.navGrowthPct] : [];
  const startYear = endYear - dists.length + 1;

  if (entry.priceType === "Fixed") {
    return dists.map((sen, index) => ({
      year: startYear + index,
      nav: 1,
      distributionSen: sen,
      distributionYieldPct: yieldFromSen(1, sen),
      returnPct: sen,
    }));
  }

  const points: UnitTrustHistoryPoint[] = [];
  let nav = currentNav;

  for (let index = dists.length - 1; index >= 0; index -= 1) {
    const year = startYear + index;
    const sen = dists[index] ?? null;
    const growthPct = growth[index] ?? 0;
    points.unshift({
      year,
      nav: Math.round(nav * 10_000) / 10_000,
      distributionSen: sen,
      distributionYieldPct: yieldFromSen(nav, sen),
      returnPct: totalReturnPct("Variable", growthPct, sen ?? 0, nav),
    });

    if (index > 0) {
      const priorGrowth = growth[index - 1] ?? growthPct;
      nav = nav / (1 + priorGrowth / 100);
    }
  }

  return points;
}

function cagr(current: number, past: number, years: number): number | null {
  if (years <= 0 || past <= 0 || current <= 0) return null;
  return (Math.pow(current / past, 1 / years) - 1) * 100;
}

function buildFund(entry: UnitTrustCatalogEntry, book: FimmPriceBook): UnitTrustFund {
  const liveNav = resolveFimmNav(book, entry.fimmNames);
  const currentNav =
    entry.priceType === "Fixed"
      ? 1
      : liveNav ?? entry.fallbackNav ?? 0;

  const history = buildHistory(entry, currentNav);
  const latest = history.at(-1);
  const prior = history.at(-2);
  const threeYearsAgo = history.at(-4);

  const latestDividendSen = latest?.distributionSen ?? null;
  const dividendYieldPct =
    entry.priceType === "Fixed"
      ? latestDividendSen
      : yieldFromSen(currentNav, latestDividendSen);

  const ytdReturn =
    entry.priceType === "Fixed"
      ? latestDividendSen
      : prior && prior.nav > 0
        ? ((currentNav / prior.nav - 1) * 100 + (latestDividendSen ?? 0) / (currentNav * 100) * 100)
        : latest?.returnPct ?? null;

  const return1yPct = ytdReturn;
  const return3yPct =
    entry.priceType === "Fixed"
      ? null
      : threeYearsAgo && threeYearsAgo.nav > 0
        ? cagr(currentNav, threeYearsAgo.nav, 3)
        : null;

  return {
    id: entry.id,
    fundCode: entry.fundCode,
    name: entry.name,
    shortName: entry.shortName,
    provider: entry.provider,
    manager: entry.provider,
    priceType: entry.priceType,
    category: entry.category,
    shariah: entry.shariah,
    shariahStatus: entry.shariah ? "SHARIAH" : "CONVENTIONAL",
    currentNav,
    ytdReturn,
    return1yPct,
    return3yPct,
    dividendYieldPct,
    distributionSen: latestDividendSen,
    latestDividendSen,
    history,
  };
}

export async function buildUnitTrustPayload(): Promise<UnitTrustApiPayload> {
  const book = await fetchFimmDailyPrices();
  const funds = UNIT_TRUST_CATALOG.map((entry) => buildFund(entry, book));

  return {
    asOf: book.asOf,
    priceDate: book.priceDate,
    source: "fimm",
    funds,
  };
}

export function buildUnitTrustPayloadFromBook(book: FimmPriceBook): UnitTrustApiPayload {
  return {
    asOf: book.asOf,
    priceDate: book.priceDate,
    source: "fimm",
    funds: UNIT_TRUST_CATALOG.map((entry) => buildFund(entry, book)),
  };
}
