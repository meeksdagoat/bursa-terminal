import type { MarketHubEtfRow, MarketHubReitRow } from "./types";

/** 13 ICB-style industry buckets mapped onto the Bursa universe sectors. */
export const ICB_SECTOR_GROUPS: { label: string; sectors: string[] }[] = [
  { label: "Technology", sectors: ["Technology", "Tech"] },
  { label: "Telecommunications", sectors: ["Telecommunications & Media", "Telco", "Media"] },
  { label: "Health Care", sectors: ["Health Care", "Healthcare"] },
  {
    label: "Financials",
    sectors: ["Financial Services", "Banking", "Financials", "Insurance"],
  },
  {
    label: "Real Estate",
    sectors: ["Property", "REIT", "Real Estate Investment Trusts"],
  },
  {
    label: "Consumer Discretionary",
    sectors: ["Consumer Products & Services", "Auto", "Gaming"],
  },
  { label: "Consumer Staples", sectors: ["Consumer"] },
  {
    label: "Industrials",
    sectors: ["Industrial Products & Services", "Industrial", "Construction"],
  },
  {
    label: "Transportation",
    sectors: ["Transportation & Logistics", "Transport"],
  },
  { label: "Basic Materials", sectors: ["Materials", "Chemicals"] },
  { label: "Energy", sectors: ["Energy"] },
  { label: "Utilities", sectors: ["Utilities"] },
  { label: "Plantation", sectors: ["Plantation"] },
];

export const REIT_SECTOR_BY_CODE: Record<string, MarketHubReitRow["reitSector"]> = {
  "5227": "Retail",
  "5235SS": "Office",
  "5212": "Retail",
  "5176": "Diversified",
  "5299": "Office",
  "5106": "Industrial",
  "5109": "Hospitality",
  "5180": "Retail",
  "5121": "Retail",
  "5127": "Diversified",
  "5269": "Diversified",
  "5307": "Industrial",
};

/** Malaysian-listed ETFs / trackers quoted on Bursa (Yahoo `*.KL`). */
export const MY_ETF_CATALOG: Array<{
  code: string;
  name: string;
  assetClass: MarketHubEtfRow["assetClass"];
  expenseRatioPct: number;
}> = [
  { code: "0820EA", name: "FTSE Bursa Malaysia KLCI ETF", assetClass: "Equity", expenseRatioPct: 0.4 },
  {
    code: "0821EA",
    name: "MyETF Dow Jones Islamic Market Malaysia Titans 25",
    assetClass: "Equity",
    expenseRatioPct: 0.4,
  },
  {
    code: "0822EA",
    name: "MyETF MSCI Malaysia Islamic Dividend",
    assetClass: "Equity",
    expenseRatioPct: 0.4,
  },
  { code: "0824EA", name: "TradePlus Shariah Gold Tracker", assetClass: "Commodity", expenseRatioPct: 0.4 },
  { code: "0825EA", name: "TradePlus NYSE FANG+ Daily (2x) Leveraged", assetClass: "Equity", expenseRatioPct: 1.0 },
  { code: "0827EA", name: "VP-DJ Shariah China A-Shares 100 ETF", assetClass: "Equity", expenseRatioPct: 0.6 },
  { code: "0828EA", name: "TradePlus HSCEI Daily (−1x) Inverse", assetClass: "Equity", expenseRatioPct: 1.0 },
  { code: "0836EA", name: "Principal FTSE ASEAN 40", assetClass: "Equity", expenseRatioPct: 0.65 },
  { code: "0838EA", name: "TradePlus S&P 500", assetClass: "Equity", expenseRatioPct: 0.3 },
  { code: "0839EA", name: "TradePlus NYSE FANG+", assetClass: "Equity", expenseRatioPct: 0.5 },
  { code: "0800EA", name: "ABF Malaysia Bond Index Fund", assetClass: "Fixed Income", expenseRatioPct: 0.19 },
];

export const WARRANT_MOTHERS = ["1155.KL", "1295.KL", "1023.KL", "5347.KL", "5183.KL", "8869.KL"];

export const INSTITUTION_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "EPF", pattern: /\b(epf|employees provident fund|kumpulan wang simpanan pekerja|kwsp)\b/i },
  { name: "PNB", pattern: /\b(pnb|permodalan nasional|amanah saham)\b/i },
  { name: "Khazanah", pattern: /\bkhazanah\b/i },
  { name: "KWAP", pattern: /\b(kwap|retirement fund|kumpulan wang persaraan)\b/i },
  { name: "LTAT", pattern: /\b(ltat|armed forces fund)\b/i },
  { name: "Tabung Haji", pattern: /\b(tabung haji|lth)\b/i },
];

export type BenchmarkSpec = {
  id: string;
  label: string;
  /** Preferred Yahoo symbols in resolution order (official → fallback → FGI). */
  symbols: string[];
  fallback: {
    price: number;
    changePct1d: number;
    changePctYtd: number;
  };
};

/** Official / fallback / FGI index tickers for Market Hub benchmark cards. */
export const BENCHMARK_SPECS: BenchmarkSpec[] = [
  {
    id: "klci",
    label: "FBM KLCI",
    symbols: ["^KLSE", "KLSE.KL"],
    fallback: { price: 1740, changePct1d: -0.39, changePctYtd: 1.8 },
  },
  {
    id: "mid70",
    label: "FBM Mid 70",
    symbols: ["^FBM70", "FBM70.KL", "FBM70.FGI"],
    fallback: { price: 17_800, changePct1d: 0.26, changePctYtd: 4.2 },
  },
  {
    id: "small",
    label: "FBM Small Cap",
    symbols: ["^FBMSCAP", "FBMSCAP.KL", "FBMSCAP.FGI"],
    fallback: { price: 15_200, changePct1d: 0.41, changePctYtd: 3.6 },
  },
  {
    id: "emas-shariah",
    label: "FBM EMAS Shariah",
    symbols: ["^FBMS", "FBMSHAR.KL", "FBMS.FGI"],
    fallback: { price: 12_700, changePct1d: 0.24, changePctYtd: 2.9 },
  },
];

export const FCPO_FALLBACK = {
  price: 3950,
  changePts: -28,
  changePct1d: -0.7,
  volume: 18_400,
};

export const FKLI_FALLBACK = {
  price: 1742.5,
  changePts: -6.5,
  changePct1d: -0.37,
  premiumPct: 0.05,
};

/** Yahoo futures symbols to try for BMD products. */
export const FCPO_SYMBOLS = ["CPO=F", "KO=F"];
export const FKLI_SYMBOLS = ["FKLI=F"];
