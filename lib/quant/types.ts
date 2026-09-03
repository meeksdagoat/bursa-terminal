/** Quant Hub domain types — client-safe except where noted in server modules. */

export type QuantFactorId =
  | "weather-agri"
  | "news-velocity"
  | "fx-beta"
  | "yield-spread"
  | "sector-breadth";

export type QuantSeriesFactorId =
  | "rainfall"
  | "temperature"
  | "usd_myr"
  | "bnm_opr"
  | "mgs_proxy"
  | "news_velocity"
  | "sector_breadth";

export type QuantDataStatus = "live" | "degraded" | "fallback";

export type QuantFactorSignal = {
  id: QuantFactorId;
  label: string;
  score: number;
  confidence: number;
  summary: string;
  targetSymbols: string[];
  status: QuantDataStatus;
  metadata: Record<string, number | string | null>;
};

export type QuantFactorOption = {
  id: QuantSeriesFactorId;
  label: string;
  unit: string;
  blurb: string;
};

export type QuantSymbolOption = {
  symbol: string;
  label: string;
  sector: string;
};

export type QuantHubPayload = {
  asOf: string;
  factors: QuantFactorSignal[];
  factorOptions: QuantFactorOption[];
  universeSize: number;
  errors: string[];
};

export type SymbolFactorsPayload = {
  asOf: string;
  symbol: string;
  symbolLabel: string;
  targetSector: string;
  factors: QuantFactorSignal[];
  errors: string[];
};

export type QuantChartPoint = {
  date: string;
  factorValue: number | null;
  price: number | null;
  volume: number | null;
};

export type QuantCorrelationPayload = {
  asOf: string;
  factorId: QuantSeriesFactorId;
  factorLabel: string;
  factorUnit: string;
  symbol: string;
  symbolLabel: string;
  priceSeriesLabel: string;
  targetSector: string;
  sectorRelevance: {
    level: "high" | "low";
    message: string | null;
  };
  windowDays: 30 | 60 | 90;
  pearsonR: number | null;
  pearsonR30: number | null;
  pearsonR60: number | null;
  pearsonR90: number | null;
  alignedTradingDays?: number;
  points: QuantChartPoint[];
  status: QuantDataStatus;
  errors: string[];
};

export const QUANT_FACTOR_OPTIONS: QuantFactorOption[] = [
  {
    id: "rainfall",
    label: "Rainfall",
    unit: "mm",
    blurb: "Open-Meteo plantation-belt precipitation",
  },
  {
    id: "temperature",
    label: "Temperature",
    unit: "°C",
    blurb: "Open-Meteo mean daily temperature",
  },
  {
    id: "usd_myr",
    label: "USD/MYR",
    unit: "MYR",
    blurb: "Ringgit cross-rate sensitivity",
  },
  {
    id: "bnm_opr",
    label: "BNM OPR",
    unit: "%",
    blurb: "Overnight policy rate level",
  },
  {
    id: "mgs_proxy",
    label: "MGS 10Y Proxy",
    unit: "idx",
    blurb: "ABF Malaysia Bond Index (0800EA) as yield proxy",
  },
  {
    id: "news_velocity",
    label: "News Velocity",
    unit: "headlines",
    blurb: "Daily headline frequency from Google News wire",
  },
  {
    id: "sector_breadth",
    label: "Sector Breadth",
    unit: "%",
    blurb: "Share of sector names above 20-day MA",
  },
];

export const QUANT_DEFAULT_SYMBOLS = [
  "2445.KL",
  "1961.KL",
  "1155.KL",
  "1295.KL",
  "5681.KL",
  "3867.KL",
  "5347.KL",
  "5183.KL",
] as const;

export const PLANTATION_SYMBOLS = ["2445.KL", "1961.KL", "5285.KL", "2089.KL"] as const;
export const EXPORT_FX_SYMBOLS = ["5681.KL", "7153.KL", "7113.KL", "5168.KL"] as const;
