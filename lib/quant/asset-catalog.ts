/** Quant Hub multi-asset catalog — client-safe. */

import {
  QUANT_ASSET_MASTER_LIST,
  QUANT_HUB_SYMBOL_SET,
  resolveQuantAssetFromMaster,
} from "@/constants/quantAssets";

export type QuantAssetCategory = "bursa" | "global" | "commodity";

export type QuantAssetCurrency = "MYR" | "USD" | "POINTS";

export type QuantAssetGroup = {
  id: QuantAssetCategory;
  label: string;
};

export type QuantAsset = {
  symbol: string;
  label: string;
  category: QuantAssetCategory;
  currency: QuantAssetCurrency;
  sector: string;
  /** Primary benchmark for equity-curve comparison. */
  benchmarkSymbol: string;
  benchmarkLabel: string;
  /** Secondary reference line on the backtest chart. */
  referenceSymbol: string;
  referenceLabel: string;
};

export const QUANT_ASSET_GROUPS: readonly QuantAssetGroup[] = [
  { id: "bursa", label: "Bursa Malaysia Equities" },
  { id: "global", label: "Global Indices & US Equities" },
  { id: "commodity", label: "Commodities & Forex Benchmarks" },
] as const;

export const QUANT_ASSET_CATALOG: readonly QuantAsset[] = QUANT_ASSET_MASTER_LIST;

const catalogBySymbol = new Map(QUANT_ASSET_CATALOG.map((asset) => [asset.symbol, asset]));

export const QUANT_HUB_SYMBOLS = QUANT_HUB_SYMBOL_SET;

export const DEFAULT_QUANT_ASSET_SYMBOL = "1155.KL";

export function isQuantHubSymbol(symbol: string): boolean {
  return QUANT_HUB_SYMBOLS.has(symbol);
}

export function resolveQuantAsset(symbol: string): QuantAsset | undefined {
  return catalogBySymbol.get(symbol) ?? resolveQuantAssetFromMaster(symbol);
}

export function assetsByCategory(category: QuantAssetCategory): QuantAsset[] {
  return QUANT_ASSET_CATALOG.filter((asset) => asset.category === category);
}

const CATEGORY_BADGE: Record<
  QuantAssetCategory,
  { label: string; className: string }
> = {
  bursa: {
    label: "BURSA",
    className: "border-gain/40 bg-gain/10 text-gain",
  },
  global: {
    label: "NASDAQ",
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  },
  commodity: {
    label: "COMMODITY",
    className: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  },
};

export function categoryBadge(category: QuantAssetCategory) {
  return CATEGORY_BADGE[category];
}

const usdPriceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const myrPriceFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pointsFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fxFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** Currency-aware price tag for Quant Hub charts and metric cards. */
export function formatAssetPrice(
  value: number | null | undefined,
  currency: QuantAssetCurrency,
): string {
  if (!isFiniteNumber(value)) return "—";

  switch (currency) {
    case "MYR":
      return `RM ${myrPriceFormatter.format(value)}`;
    case "USD":
      return `$${usdPriceFormatter.format(value)} USD`;
    case "POINTS":
      return `${pointsFormatter.format(value)} pts`;
    default:
      return usdPriceFormatter.format(value);
  }
}

/** Compact Y-axis tick for equity curves (capital in native currency). */
export function formatAssetCapitalTick(
  value: number,
  currency: QuantAssetCurrency,
): string {
  const abs = Math.abs(value);
  const compact =
    abs >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : abs >= 1_000
        ? `${(value / 1_000).toFixed(1)}k`
        : value.toFixed(0);

  switch (currency) {
    case "MYR":
      return `RM ${compact}`;
    case "USD":
      return `$${compact}`;
    case "POINTS":
      return `${compact} pts`;
    default:
      return compact;
  }
}

/** FX pairs use tighter decimal formatting. */
export function formatAssetSpotPrice(
  value: number | null | undefined,
  asset: QuantAsset,
): string {
  if (!isFiniteNumber(value)) return "—";
  if (asset.symbol === "USDMYR=X") {
    return `RM ${fxFormatter.format(value)}`;
  }
  return formatAssetPrice(value, asset.currency);
}

export function capitalFieldLabel(currency: QuantAssetCurrency): string {
  switch (currency) {
    case "USD":
      return "Capital (USD)";
    case "POINTS":
      return "Capital (Units)";
    default:
      return "Capital (RM)";
  }
}
