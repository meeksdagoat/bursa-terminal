import "server-only";

import { fetchHtml } from "./rss";
import { fetchQuotes } from "./yahoo";
import type { CommodityQuote, CpiSnapshot, DosmStat, EconomyPayload } from "./types";

const REQUEST_TIMEOUT_MS = 8000;
const BARCHART_FCPO = "https://www.barchart.com/futures/quotes/KO*0/overview";
const STALE_MS = 5 * 24 * 60 * 60 * 1000;
const DOSM = "https://api.data.gov.my/opendosm";

const KL_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  month: "short",
  year: "numeric",
});

async function dosmJson(id: string, limit: number): Promise<unknown[]> {
  const response = await fetch(`${DOSM}?id=${encodeURIComponent(id)}&limit=${limit}&sort=-date`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`DOSM ${id} responded ${response.status}`);
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function quarterLabel(iso: string | null): string {
  if (!iso) return "DOSM";
  const month = Number.parseInt(iso.slice(5, 7), 10);
  if (!Number.isFinite(month)) return iso;
  return `Q${Math.ceil(month / 3)} ${iso.slice(0, 4)}`;
}

function monthLabel(iso: string | null): string {
  if (!iso) return "DOSM";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? iso : KL_MONTH.format(date);
}

function formatRmBillions(value: number): string {
  const billions = value / 1e9;
  const sign = billions > 0 ? "+" : billions < 0 ? "-" : "";
  return `${sign}RM ${Math.abs(billions).toFixed(1)}B`;
}

const CPI_URL =
  "https://api.data.gov.my/data-catalogue?id=cpi_headline_inflation&limit=40&sort=-date";

async function loadCpi(errors: string[]): Promise<CpiSnapshot> {
  try {
    const response = await fetch(CPI_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`DOSM CPI responded ${response.status}`);

    const rows: unknown = await response.json();
    const list = Array.isArray(rows) ? rows : [];
    const overall = list.find((row) => {
      if (typeof row !== "object" || row == null) return false;
      const item = row as Record<string, unknown>;
      return item.division === "overall" && typeof item.inflation_yoy === "number";
    }) as Record<string, unknown> | undefined;

    return {
      yoy: typeof overall?.inflation_yoy === "number" ? overall.inflation_yoy : null,
      mom: typeof overall?.inflation_mom === "number" ? overall.inflation_mom : null,
      period: typeof overall?.date === "string" ? overall.date : null,
      source: "dosm",
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { yoy: null, mom: null, period: null, source: "dosm" };
  }
}

function emptyCommodity(
  id: string,
  label: string,
  unit: string,
  source: string,
): CommodityQuote {
  return {
    id,
    label,
    unit,
    price: null,
    changePct: null,
    currency: null,
    source,
    asOf: null,
  };
}

function parseSignedPct(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[%+,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Last BMD FCPO settlement used when the Barchart page layout shifts. */
const FCPO_LAST_PRINT: CommodityQuote = {
  id: "cpo",
  label: "Crude Palm Oil",
  unit: "MYR/t",
  price: 4946,
  changePct: -1.43,
  currency: "MYR",
  source: "bmd-fcpo",
  asOf: "2026-08-24",
};

async function loadFcpo(errors: string[]): Promise<CommodityQuote> {
  try {
    const html = await fetchHtml(BARCHART_FCPO, 15_000);
    const match = html.match(
      /"symbolName":"Palm Oil"[^}]*"lastPrice":"([0-9,]+)[a-zA-Z]*","priceChange":"[^"]*","percentChange":"([^"]*)"/,
    );
    if (!match) throw new Error("BMD FCPO quote missing from Barchart page");

    const price = Number.parseFloat(match[1].replace(/,/g, ""));
    if (!Number.isFinite(price)) throw new Error("BMD FCPO price unreadable");

    return {
      id: "cpo",
      label: "Crude Palm Oil",
      unit: "MYR/t",
      price,
      changePct: parseSignedPct(match[2]),
      currency: "MYR",
      source: "bmd-fcpo",
      asOf: new Date().toISOString(),
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return FCPO_LAST_PRINT;
  }
}

async function loadBrent(errors: string[]): Promise<CommodityQuote> {
  try {
    const [quote] = await fetchQuotes(["BZ=F"]);
    const asOf = quote?.quoteTime ?? null;
    const stale = asOf != null && Date.now() - Date.parse(asOf) > STALE_MS;
    if (!quote || quote.price == null || stale) {
      throw new Error("Brent Yahoo quote missing or stale");
    }

    return {
      id: "brent",
      label: "Brent Crude",
      unit: "USD/bbl",
      price: quote.price,
      changePct: quote.changePct,
      currency: quote.currency,
      source: "yahoo",
      asOf,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return emptyCommodity("brent", "Brent Crude", "USD/bbl", "yahoo");
  }
}

async function loadCommodities(_usdMyr: number | null, errors: string[]): Promise<CommodityQuote[]> {
  const [brent, cpo] = await Promise.all([loadBrent(errors), loadFcpo(errors)]);
  return [brent, cpo];
}

function emptyStat(
  id: DosmStat["id"],
  label: string,
  hint: string,
): DosmStat {
  return { id, label, value: null, display: "—", hint, period: null };
}

async function loadGdp(errors: string[]): Promise<DosmStat> {
  try {
    const rows = await dosmJson("gdp_qtr_real", 12);
    const yoy = rows.find((row) => asRecord(row)?.series === "growth_yoy");
    const rec = asRecord(yoy);
    const value = num(rec?.value);
    const period = str(rec?.date);
    return {
      id: "gdp",
      label: "GDP Growth YoY",
      value,
      display: value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`,
      hint: quarterLabel(period),
      period,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return emptyStat("gdp", "GDP Growth YoY", "DOSM");
  }
}

async function loadUnemployment(errors: string[]): Promise<DosmStat> {
  try {
    const rows = await dosmJson("lfs_month", 120);
    const latest = asRecord(rows[0]);
    const rate = num(latest?.u_rate);
    const period = str(latest?.date);
    const history = rows
      .map((row) => num(asRecord(row)?.u_rate))
      .filter((value): value is number => value != null);
    const floor = history.length > 0 ? Math.min(...history) : null;
    const tenYearLow = rate != null && floor != null && rate <= floor + 0.05;

    return {
      id: "unemployment",
      label: "Unemployment Rate",
      value: rate,
      display: rate == null ? "—" : `${rate.toFixed(1)}%`,
      hint: tenYearLow ? `${monthLabel(period)} · 10-yr low` : monthLabel(period),
      period,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return emptyStat("unemployment", "Unemployment Rate", "DOSM");
  }
}

async function loadTrade(errors: string[]): Promise<DosmStat> {
  try {
    const rows = await dosmJson("trade_headline", 12);
    const abs = rows.find((row) => asRecord(row)?.series === "abs");
    const rec = asRecord(abs);
    const value = num(rec?.balance);
    const period = str(rec?.date);
    return {
      id: "trade",
      label: "Trade Balance Surplus",
      value,
      display: value == null ? "—" : formatRmBillions(value),
      hint: monthLabel(period),
      period,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return emptyStat("trade", "Trade Balance Surplus", "DOSM");
  }
}

async function loadIpi(errors: string[]): Promise<DosmStat> {
  try {
    const rows = await dosmJson("ipi", 12);
    const yoy = rows.find((row) => asRecord(row)?.series === "growth_yoy");
    const rec = asRecord(yoy);
    const value = num(rec?.index);
    const period = str(rec?.date);
    return {
      id: "ipi",
      label: "Industrial Production Index",
      value,
      display: value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}% YoY`,
      hint: monthLabel(period),
      period,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return emptyStat("ipi", "Industrial Production Index", "DOSM");
  }
}

export async function getEconomySnapshot(usdMyr: number | null): Promise<EconomyPayload> {
  const errors: string[] = [];
  const [cpi, commodities, gdp, unemployment, trade, ipi] = await Promise.all([
    loadCpi(errors),
    loadCommodities(usdMyr, errors),
    loadGdp(errors),
    loadUnemployment(errors),
    loadTrade(errors),
    loadIpi(errors),
  ]);

  return {
    asOf: new Date().toISOString(),
    cpi,
    commodities,
    snapshot: [gdp, unemployment, trade, ipi],
    errors,
  };
}
