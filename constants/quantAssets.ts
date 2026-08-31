import type { QuantAsset, QuantAssetCategory } from "@/lib/quant/asset-catalog";
import { usTickersToQuantAssets } from "@/constants/usTickers";
import { universe } from "@/lib/universe";

export type QuantAssetFilter = "all" | QuantAssetCategory;

const BURSA_BENCHMARK = {
  benchmarkSymbol: "^KLSE",
  benchmarkLabel: "FBM KLCI",
  referenceSymbol: "^GSPC",
  referenceLabel: "S&P 500",
} as const;

const GLOBAL_BENCHMARK = {
  benchmarkSymbol: "^GSPC",
  benchmarkLabel: "S&P 500",
  referenceSymbol: "QQQ",
  referenceLabel: "Nasdaq 100",
} as const;

const COMMODITY_BENCHMARK = {
  benchmarkSymbol: "^GSPC",
  benchmarkLabel: "S&P 500",
  referenceSymbol: "CL=F",
  referenceLabel: "WTI Crude",
} as const;

export const GLOBAL_QUANT_ASSETS: QuantAsset[] = [
  { symbol: "^GSPC", label: "S&P 500 Index", category: "global", currency: "USD", sector: "Index", ...GLOBAL_BENCHMARK },
  { symbol: "QQQ", label: "Nasdaq 100 ETF", category: "global", currency: "USD", sector: "Index", ...GLOBAL_BENCHMARK },
  ...usTickersToQuantAssets(),
];

export const COMMODITY_QUANT_ASSETS: QuantAsset[] = [
  {
    symbol: "GC=F",
    label: "Spot Gold",
    category: "commodity",
    currency: "USD",
    sector: "Commodity",
    benchmarkSymbol: "^GSPC",
    benchmarkLabel: "S&P 500",
    referenceSymbol: "GC=F",
    referenceLabel: "Gold",
  },
  {
    symbol: "XAUUSD=X",
    label: "Gold XAU/USD",
    category: "commodity",
    currency: "USD",
    sector: "Commodity",
    benchmarkSymbol: "^GSPC",
    benchmarkLabel: "S&P 500",
    referenceSymbol: "GC=F",
    referenceLabel: "Gold",
  },
  {
    symbol: "BZ=F",
    label: "Brent Crude Oil",
    category: "commodity",
    currency: "USD",
    sector: "Energy",
    ...COMMODITY_BENCHMARK,
  },
  {
    symbol: "KO=F",
    label: "Crude Palm Oil (FCPO)",
    category: "commodity",
    currency: "MYR",
    sector: "Commodity",
    benchmarkSymbol: "^KLSE",
    benchmarkLabel: "FBM KLCI",
    referenceSymbol: "KO=F",
    referenceLabel: "FCPO",
  },
  {
    symbol: "USDMYR=X",
    label: "USD/MYR FX",
    category: "commodity",
    currency: "MYR",
    sector: "Forex",
    benchmarkSymbol: "USDMYR=X",
    benchmarkLabel: "USD/MYR",
    referenceSymbol: "^GSPC",
    referenceLabel: "S&P 500",
  },
  {
    symbol: "BTC-USD",
    label: "Bitcoin",
    category: "commodity",
    currency: "USD",
    sector: "Crypto",
    benchmarkSymbol: "^GSPC",
    benchmarkLabel: "S&P 500",
    referenceSymbol: "BTC-USD",
    referenceLabel: "Bitcoin",
  },
];

const EXTRA_SEARCH_ALIASES: Record<string, string[]> = {
  "GC=F": ["gold", "xau", "xauusd"],
  "XAUUSD=X": ["gold", "xau", "xauusd", "spot gold"],
  "KO=F": ["fcpo", "cpo", "palm oil"],
  "BZ=F": ["brent", "crude", "oil"],
  "USDMYR=X": ["usdmyr", "ringgit", "fx", "forex"],
  "BTC-USD": ["bitcoin", "btc", "crypto"],
  "^GSPC": ["sp500", "s&p", "snp"],
  "QQQ": ["nasdaq100", "nasdaq"],
};

function bursaAssetsFromUniverse(): QuantAsset[] {
  return universe.map((entry) => ({
    symbol: entry.symbol,
    label: entry.name,
    category: "bursa" as const,
    currency: "MYR" as const,
    sector: entry.sector,
    ...BURSA_BENCHMARK,
  }));
}

export const BURSA_QUANT_ASSETS = bursaAssetsFromUniverse();

export const QUANT_ASSET_MASTER_LIST: QuantAsset[] = [
  ...BURSA_QUANT_ASSETS,
  ...GLOBAL_QUANT_ASSETS,
  ...COMMODITY_QUANT_ASSETS,
];

type IndexedQuantAsset = QuantAsset & {
  code: string;
  needles: string[];
};

function uniqueLower(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const needle = value.toLowerCase().replace(/\.kl$/, "").trim();
    if (!needle || seen.has(needle)) continue;
    seen.add(needle);
    out.push(needle);
  }
  return out;
}

function indexAsset(asset: QuantAsset): IndexedQuantAsset {
  const entry = universe.find((row) => row.symbol === asset.symbol);
  const code = entry?.code ?? asset.symbol.replace(".KL", "");
  const needles = uniqueLower([
    asset.symbol,
    code,
    asset.label,
    entry?.shortName ?? "",
    entry?.name ?? "",
    entry?.fullName ?? "",
    asset.sector,
    ...(entry?.aliases ?? []),
    ...(EXTRA_SEARCH_ALIASES[asset.symbol] ?? []),
    ...(asset.category === "global" && asset.sector !== "Index" ? [asset.sector.toLowerCase()] : []),
  ]);

  return { ...asset, code, needles };
}

let indexedAssetsCache: IndexedQuantAsset[] | null = null;
let assetBySymbolCache: Map<string, IndexedQuantAsset> | null = null;

function getIndexedAssets(): IndexedQuantAsset[] {
  if (!indexedAssetsCache) {
    indexedAssetsCache = QUANT_ASSET_MASTER_LIST.map(indexAsset);
  }
  return indexedAssetsCache;
}

function getAssetBySymbol(): Map<string, IndexedQuantAsset> {
  if (!assetBySymbolCache) {
    assetBySymbolCache = new Map(getIndexedAssets().map((asset) => [asset.symbol, asset]));
  }
  return assetBySymbolCache;
}

export function getQuantAssetCount(): number {
  return QUANT_ASSET_MASTER_LIST.length;
}

export function resolveQuantAssetFromMaster(symbol: string): QuantAsset | undefined {
  return getAssetBySymbol().get(symbol);
}

function rankMatch(needles: string[], query: string): number {
  if (needles.some((field) => field === query)) return 0;
  if (needles[0] === query || needles[0]?.startsWith(query)) return 1;
  if (needles.some((field) => field.startsWith(query))) return 2;
  if (needles.some((field) => field.includes(query))) return 3;
  return -1;
}

function filterByCategory(assets: IndexedQuantAsset[], filter: QuantAssetFilter): IndexedQuantAsset[] {
  if (filter === "all") return assets;
  return assets.filter((asset) => asset.category === filter);
}

function findExactAsset(needle: string, filter: QuantAssetFilter): IndexedQuantAsset | undefined {
  const raw = needle.trim();
  const lower = raw.toLowerCase().replace(/\.kl$/, "");
  const candidates = [
    raw,
    raw.toUpperCase(),
    `${lower}.kl`.toUpperCase(),
    `${raw.toUpperCase()}.KL`,
  ];

  const indexed = getIndexedAssets();
  const bySymbol = getAssetBySymbol();

  for (const key of candidates) {
    const hit = bySymbol.get(key);
    if (hit && (filter === "all" || hit.category === filter)) return hit;
  }

  for (const asset of indexed) {
    if (asset.code.toLowerCase() === lower && (filter === "all" || asset.category === filter)) {
      return asset;
    }
  }

  return undefined;
}

function globalAssetPriority(asset: IndexedQuantAsset): number {
  if (asset.sector === "Index") return 0;
  if (asset.sector === "S&P 500") return 1;
  if (asset.sector === "NASDAQ") return 2;
  if (asset.sector === "NYSE") return 3;
  return 4;
}

export function searchQuantAssets(
  query: string,
  filter: QuantAssetFilter = "bursa",
  renderLimit = 40,
): { results: QuantAsset[]; totalMatches: number } {
  const indexed = getIndexedAssets();
  const pool = filterByCategory(indexed, filter);
  const needle = query.trim().toLowerCase().replace(/\.kl$/, "");

  if (!needle) {
    const sorted =
      filter === "global"
        ? [...pool].sort(
            (left, right) =>
              globalAssetPriority(left) - globalAssetPriority(right) ||
              left.label.localeCompare(right.label),
          )
        : pool;

    return {
      results: sorted.slice(0, renderLimit),
      totalMatches: pool.length,
    };
  }

  const exact = findExactAsset(query, filter);

  const matches: Array<{ asset: IndexedQuantAsset; score: number }> = [];
  if (exact) matches.push({ asset: exact, score: -1 });

  for (const asset of pool) {
    if (exact && asset.symbol === exact.symbol) continue;
    const score = rankMatch(asset.needles, needle);
    if (score >= 0) matches.push({ asset, score });
  }

  const sorted = matches
    .sort(
      (left, right) =>
        left.score - right.score || left.asset.label.localeCompare(right.asset.label),
    )
    .map(({ asset }) => asset);

  return {
    results: sorted.slice(0, renderLimit),
    totalMatches: sorted.length,
  };
}

export function formatQuantAssetLabel(asset: QuantAsset): string {
  if (asset.category === "bursa") {
    const code = asset.symbol.replace(".KL", "");
    return `${asset.label} (${code}.KL)`;
  }
  return `${asset.label} (${asset.symbol})`;
}

export const QUANT_ASSET_FILTER_PILLS = [
  { id: "all" as const, label: "ALL" },
  { id: "bursa" as const, label: "BURSA MY" },
  { id: "global" as const, label: "NASDAQ / US" },
  { id: "commodity" as const, label: "COMMODITIES / FX" },
];

export const QUANT_HUB_SYMBOL_SET = new Set(QUANT_ASSET_MASTER_LIST.map((asset) => asset.symbol));
