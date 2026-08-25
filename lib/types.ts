import type { HeadlineCategory } from "./categories";

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

export type DailyClose = {
  time: number;
  close: number;
};

export type HistoryPayload = {
  source: "yahoo";
  asOf: string;
  from: string;
  series: Record<string, DailyClose[]>;
  errors: string[];
};

/** A universe member that resolved to a usable quote, so `quote` is never null. */
export type MoverRow = UniverseEntry & {
  quote: Quote;
};

export type MarketBreadth = {
  advancers: number;
  decliners: number;
  unchanged: number;
  /** Universe members that traded today and therefore carry a usable move. */
  covered: number;
  universe: number;
};

export type MoversPayload = {
  source: "yahoo";
  asOf: string;
  delayMinutes: number | null;
  marketState: string | null;
  index: Quote | null;
  gainers: MoverRow[];
  losers: MoverRow[];
  breadth: MarketBreadth;
  /** Per-batch failures; the payload still resolves so one dead batch cannot blank the board. */
  errors: string[];
};

export type Headline = {
  id: string;
  title: string;
  publisher: string | null;
  url: string | null;
  publishedAt: string | null;
  tag: string | null;
  /** RSS/Yahoo blurb when it is real article copy, otherwise null. */
  snippet: string | null;
};

export type HeadlinesPayload = {
  source: "google-news";
  category: HeadlineCategory;
  label: string;
  asOf: string;
  items: Headline[];
  errors: string[];
};

export type CommodityQuote = {
  id: string;
  label: string;
  unit: string;
  price: number | null;
  changePct: number | null;
  currency: string | null;
  source: string;
  asOf: string | null;
};

export type CpiSnapshot = {
  yoy: number | null;
  mom: number | null;
  period: string | null;
  source: "dosm";
};

export type DosmStat = {
  id: "gdp" | "unemployment" | "trade" | "ipi";
  label: string;
  value: number | null;
  display: string;
  hint: string;
  period: string | null;
};

export type EconomyPayload = {
  asOf: string;
  cpi: CpiSnapshot;
  commodities: CommodityQuote[];
  snapshot: DosmStat[];
  errors: string[];
};

export type PolicyRate = {
  id: "fed" | "ecb" | "boj" | "pboc";
  bank: string;
  label: string;
  region: string;
  instrument: string;
  rate: number | null;
  changeBps: number | null;
  asOf: string | null;
  source: string;
};

export type GlobalMarketQuote = {
  id: string;
  symbol: string;
  label: string;
  unit: string;
  price: number | null;
  changePct: number | null;
  currency: string | null;
  asOf: string | null;
};

export type GlobalEconomyPayload = {
  asOf: string;
  rates: PolicyRate[];
  markets: GlobalMarketQuote[];
  errors: string[];
};

export type GlobalMarketsPayload = {
  asOf: string;
  markets: GlobalMarketQuote[];
  errors: string[];
};

export type FilingCategory = "QR" | "IA" | "GA" | "DIV" | "BOARD" | "AL" | "OTHER";

export type Filing = {
  id: string;
  category: FilingCategory;
  title: string;
  url: string | null;
  publishedAt: string | null;
  source: string;
};

export type FilingsPayload = {
  symbol: string;
  company: string;
  asOf: string;
  items: Filing[];
  errors: string[];
};

export type AnnouncementCategory =
  | "Financial Result"
  | "Shareholding Change"
  | "General Announcement"
  | "Dividend"
  | "Board Change"
  | "Additional Listing"
  | "Other";

export type BursaAnnouncement = {
  id: string;
  title: string;
  category: AnnouncementCategory;
  publishedAt: string | null;
  url: string | null;
  source: string;
};

export type BursaAnnouncementsPayload = {
  source: "bursa" | "google-news";
  symbol: string;
  company: string;
  asOf: string;
  items: BursaAnnouncement[];
};

export type WarrantType = "Call" | "Put";

export type StructuredWarrant = {
  code: string;
  symbol: string;
  name: string | null;
  type: WarrantType;
  lastPrice: number | null;
  changePct: number | null;
  volume: number | null;
  expiry: string | null;
  quoteSource: "yahoo" | "screener";
};

export type WarrantsPayload = {
  symbol: string;
  company: string;
  asOf: string;
  items: StructuredWarrant[];
};

export type OfficialDesk = {
  handle: string;
  org: string;
  blurb: string;
  items: OfficialPost[];
};

export type OfficialPost = {
  id: string;
  handle: string;
  title: string;
  url: string | null;
  publishedAt: string | null;
  publisher: string | null;
};

export type OfficialPayload = {
  asOf: string;
  desks: OfficialDesk[];
  errors: string[];
};

export type MacroSource = "BNM" | "MOF" | "PM" | "POLICY";

export type MacroItem = {
  id: string;
  source: MacroSource;
  title: string;
  publisher: string | null;
  url: string | null;
  publishedAt: string | null;
};

export type MacroPayload = {
  source: "google-news";
  asOf: string;
  items: MacroItem[];
  /** Per-feed failures; the payload still resolves so one dead query cannot blank the tab. */
  errors: string[];
};

export type NewsItem = {
  id: string;
  tag: string;
  headline: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  snippet: string | null;
};

export type NewsPayload = {
  source: "google-news" | "yahoo+google-news";
  asOf: string;
  items: NewsItem[];
  /** Tags present in `items`, most frequent first, for the sidebar filter row. */
  tags: string[];
  errors: string[];
};

export type CompanyNewsPayload = NewsPayload & {
  symbol: string;
  company: string;
};

/** One reported quarter. Amounts are reporting currency; EPS is per share. Null = not reported. */
export type QuarterlyResult = {
  period: string;
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  revenue: number | null;
  netProfit: number | null;
  eps: number | null;
  revenueYoyPct: number | null;
  netProfitYoyPct: number | null;
  epsYoyPct: number | null;
};

/** Full-year P&L / cash / leverage snapshot. Null = line item not reported for that year. */
export type AnnualResult = {
  year: number;
  revenue: number | null;
  grossProfit: number | null;
  netInterestIncome: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  debtToEquity: number | null;
};

/** Banks/insurers use net interest income; operating companies use gross profit. */
export type FundamentalsProfitLine = "grossProfit" | "netInterestIncome";

export type FundamentalsPayload = {
  source: "yahoo";
  symbol: string;
  company: string;
  currency: string;
  asOf: string;
  profitLine: FundamentalsProfitLine;
  quarterly: QuarterlyResult[];
  annual: AnnualResult[];
};

export type CorporateEventType =
  | "layoffs"
  | "ma"
  | "management"
  | "expansion"
  | "contract"
  | "regulatory";

export type EventImpact = "high" | "medium" | "low";
export type EventSentiment = "positive" | "negative" | "neutral";

export type CorporateEvent = {
  id: string;
  date: string;
  type: CorporateEventType;
  impact: EventImpact;
  sentiment: EventSentiment;
  title: string;
  summary: string;
  source: string;
  url: string | null;
};

export type CorporateEventsPayload = {
  /** `"stub"` until a live events/news timeline provider is wired in the route. */
  source: "stub";
  symbol: string;
  company: string;
  asOf: string;
  items: CorporateEvent[];
};

/** Live Yahoo quoteSummary snapshot for a Bursa ticker. Dates are KL-formatted. */
export type BursaQuote = {
  source: "yahoo";
  symbol: string;
  companyName: string;
  price: number | null;
  dayChangePercent: number | null;
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  roe: number | null;
  exDividendDate: string | null;
  earningsDate: string | null;
  /** ISO timestamps used by the corporate-action calendar. */
  exDividendAt: string | null;
  dividendAt: string | null;
  earningsAt: string[];
  asOf: string;
};
