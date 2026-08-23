export type UniverseEntry = {
  symbol: string;
  code: string;
  name: string;
  sector: string;
  shariah: boolean;
};

export type WatchlistRow = UniverseEntry & {
  quote: Quote | null;
};

export type Quote = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  pe: number | null;
  marketCap: number | null;
  dividendYieldPct: number | null;
  currency: string | null;
  marketState: string | null;
  delayMinutes: number | null;
  quoteTime: string | null;
};

export type SectorPerformance = {
  name: string;
  changePct: number | null;
  count: number;
};

export type QuotesPayload = {
  source: "yahoo";
  asOf: string;
  delayMinutes: number | null;
  marketState: string | null;
  quotes: Quote[];
  index: Quote | null;
  sectors: SectorPerformance[];
};

export type FxRate = {
  pair: string;
  currencyCode: string;
  rate: number | null;
  previousRate: number | null;
  changePct: number | null;
  date: string | null;
  previousDate: string | null;
};

export type OprSnapshot = {
  level: number | null;
  changeBps: number | null;
  effectiveDate: string | null;
  lastUpdated: string | null;
};

export type BnmPayload = {
  source: "bnm";
  session: string;
  asOf: string;
  rates: FxRate[];
  opr: OprSnapshot;
  errors: string[];
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type CandlesPayload = {
  symbol: string;
  range: string;
  interval: string;
  intraday: boolean;
  currency: string | null;
  previousClose: number | null;
  candles: Candle[];
};

export type Filing = {
  time: string;
  ticker: string;
  type: string;
  title: string;
};

export type MacroItem = {
  time: string;
  source: "BNM" | "MOF" | "PM" | "POLICY";
  title: string;
  body: string;
};

export type NewsItem = {
  time: string;
  tag: string;
  headline: string;
  source: string;
};
