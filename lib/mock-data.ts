import type { Filing, MacroItem, NewsItem } from "./types";

/**
 * Filings, macro commentary and news are sample content: Bursa announcements and
 * local newswires have no free public API. Prices, FX and the OPR are live
 * (see lib/yahoo.ts and lib/bnm.ts).
 */

export const filings: Filing[] = [
  {
    time: "16:42",
    ticker: "1155.KL",
    type: "QR",
    title: "Maybank 2Q net profit RM2.58bn, interim DPS 30 sen",
  },
  {
    time: "16:18",
    ticker: "5347.KL",
    type: "GA",
    title: "Tenaga awards RM1.2bn grid upgrade contracts in Peninsular",
  },
  {
    time: "15:55",
    ticker: "1295.KL",
    type: "IA",
    title: "Public Bank: change in substantial shareholder interest",
  },
  {
    time: "15:31",
    ticker: "0166.KL",
    type: "QR",
    title: "Inari 4Q revenue RM380m on OSAT recovery; guidance raised",
  },
  {
    time: "14:47",
    ticker: "3182.KL",
    type: "GA",
    title: "Genting: Resorts World Genting visitor traffic update",
  },
  {
    time: "14:12",
    ticker: "1023.KL",
    type: "GA",
    title: "CIMB Group completes RM2.0bn tier-2 subordinated note issuance",
  },
  {
    time: "13:40",
    ticker: "5183.KL",
    type: "QR",
    title: "Petronas Chemicals: plant utilisation recovers to 94%",
  },
  {
    time: "12:58",
    ticker: "6012.KL",
    type: "IA",
    title: "Maxis: notification of shares bought back by the company",
  },
];

export const macroFeed: MacroItem[] = [
  {
    time: "16:22",
    source: "MOF",
    title: "Budget 2026 fiscal path",
    body: "Deficit target narrowed to 3.8% of GDP; subsidy rationalisation proceeds with targeted RON95.",
  },
  {
    time: "15:48",
    source: "PM",
    title: "PM on Johor–Singapore SEZ",
    body: "JS-SEZ to unlock RM25bn committed FDI in data centres, logistics and advanced manufacturing.",
  },
  {
    time: "14:10",
    source: "POLICY",
    title: "NETR Phase 2",
    body: "Energy transition roadmap targets higher RE capacity, with the TNB grid as backbone for corporate PPAs.",
  },
  {
    time: "12:36",
    source: "BNM",
    title: "Ringgit intervention stance",
    body: "BNM reiterates two-way flexibility; FX reserves cover 5.4 months of retained imports.",
  },
];

export const newsItems: NewsItem[] = [
  {
    time: "17:12",
    tag: "#Banking",
    headline: "Maybank, CIMB lead loan growth as SME demand firms",
    source: "The Edge",
  },
  {
    time: "16:58",
    tag: "#Policy",
    headline: "MPC holds policy rate; ringgit firms against the dollar",
    source: "Bernama",
  },
  {
    time: "16:41",
    tag: "#Property",
    headline: "KL Sentral office yields compress on REIT bids",
    source: "The Star",
  },
  {
    time: "16:20",
    tag: "#Genting",
    headline: "Genting Malaysia: RWGenting occupancy recovers to 94%",
    source: "Bloomberg",
  },
  {
    time: "15:54",
    tag: "#Banking",
    headline: "Public Bank NIM stable; asset quality remains pristine",
    source: "Reuters",
  },
  {
    time: "15:33",
    tag: "#Policy",
    headline: "Subsidy retargeting: RON95 two-tier rollout timeline",
    source: "MoF",
  },
  {
    time: "15:08",
    tag: "#Property",
    headline: "Johor industrial land prices jump on JS-SEZ inflows",
    source: "The Edge",
  },
  {
    time: "14:44",
    tag: "#Genting",
    headline: "Singapore IR competition vs Genting Highlands traffic",
    source: "Nikkei",
  },
  {
    time: "14:19",
    tag: "#Banking",
    headline: "Islamic finance AUM on track for RM1tn by 2027",
    source: "BNM",
  },
  {
    time: "13:52",
    tag: "#Policy",
    headline: "PM: data-centre power allocation to stay disciplined",
    source: "PMO",
  },
];
