import { NEWS_WINDOW_DAYS } from "./news-window";
import { categoryLabel, type HeadlineCategory } from "./categories";
import { rankTags } from "./news";
import type { Headline, HeadlinesPayload, NewsItem, NewsPayload, OfficialPayload } from "./types";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const MARKET_FALLBACK: NewsItem[] = [
  {
    id: "cache-bursa-1",
    tag: "#Markets",
    headline: "Bursa Malaysia trading update — local desks await the next heavyweight print",
    source: "Wire cache",
    url: "https://www.bursamalaysia.com/",
    publishedAt: daysAgo(1),
    snippet: "Cached market brief while live wires recover. Coverage window: previous 365 days.",
  },
  {
    id: "cache-bursa-2",
    tag: "#Policy",
    headline: "Bank Negara and the ringgit remain the domestic macro anchors",
    source: "Wire cache",
    url: "https://www.bnm.gov.my/",
    publishedAt: daysAgo(12),
    snippet: "Policy and FX coverage from the cached wire when Google News or Yahoo RSS is unavailable.",
  },
  {
    id: "cache-bursa-3",
    tag: "#Earnings",
    headline: "Listed-company results season — scan announcements for the official PDF",
    source: "Wire cache",
    url: "https://www.bursamalaysia.com/market_information/announcements/company_announcement",
    publishedAt: daysAgo(40),
    snippet: "Use the Official Filing drawer for Bursa PDFs when the news wire is degraded.",
  },
];

const POLITICS_FALLBACK: Headline[] = [
  {
    id: "cache-politics-1",
    title: "Putrajaya policy watch — cabinet, subsidy and Budget coverage on a 365-day window",
    publisher: "Wire cache",
    url: "https://www.pmo.gov.my/",
    publishedAt: daysAgo(2),
    tag: "#Cabinet",
    snippet: "Cached politics desk while live RSS providers recover.",
  },
  {
    id: "cache-politics-2",
    title: "Parliament and fiscal policy remain the main local political tape",
    publisher: "Wire cache",
    url: "https://www.parlimen.gov.my/",
    publishedAt: daysAgo(18),
    tag: "#Parliament",
    snippet: "Historical politics stories stay in the 365-day archive when the live feed times out.",
  },
];

const GLOBAL_FALLBACK: Headline[] = [
  {
    id: "cache-global-1",
    title: "Fed, ECB and Treasury yields — global macro tape on a 365-day lookback",
    publisher: "Wire cache",
    url: "https://www.federalreserve.gov/",
    publishedAt: daysAgo(3),
    tag: "#Fed",
    snippet: "Cached global economy brief used when live wires return HTTP 503 or time out.",
  },
  {
    id: "cache-global-2",
    title: "Brent, gold and US CPI remain the cross-asset markers",
    publisher: "Wire cache",
    url: "https://www.bls.gov/",
    publishedAt: daysAgo(21),
    tag: "#CPI",
    snippet: "Fallback macro items so the desk never renders a raw backend timeout string.",
  },
];

export function fallbackNewsPayload(): NewsPayload {
  return {
    source: "cache",
    asOf: new Date().toISOString(),
    items: MARKET_FALLBACK,
    tags: rankTags(MARKET_FALLBACK),
    errors: [`live-wire-unavailable:${NEWS_WINDOW_DAYS}d`],
  };
}

export function fallbackOfficialPayload(): OfficialPayload {
  return {
    asOf: new Date().toISOString(),
    desks: [
      {
        handle: "@anwaribrahim",
        org: "Prime Minister",
        blurb: "PMO statements and Anwar Ibrahim remarks",
        items: [
          {
            id: "cache-official-pmo",
            handle: "@anwaribrahim",
            title: "PMO statement tape — cached while the live official wire recovers",
            url: "https://www.pmo.gov.my/",
            publishedAt: daysAgo(2),
            publisher: "Wire cache",
          },
        ],
      },
      {
        handle: "@MoFMalaysia",
        org: "Ministry of Finance",
        blurb: "Fiscal, budget and subsidy statements",
        items: [
          {
            id: "cache-official-mof",
            handle: "@MoFMalaysia",
            title: "Treasury and Budget coverage remains on a 365-day lookback",
            url: "https://www.mof.gov.my/",
            publishedAt: daysAgo(14),
            publisher: "Wire cache",
          },
        ],
      },
      {
        handle: "@BNM_official",
        org: "Bank Negara Malaysia",
        blurb: "Monetary policy and ringgit statements",
        items: [
          {
            id: "cache-official-bnm",
            handle: "@BNM_official",
            title: "Bank Negara policy and ringgit notes — cached 365-day window",
            url: "https://www.bnm.gov.my/",
            publishedAt: daysAgo(9),
            publisher: "Wire cache",
          },
        ],
      },
    ],
    errors: [`live-wire-unavailable:${NEWS_WINDOW_DAYS}d`],
  };
}

export function fallbackHeadlinesPayload(category: HeadlineCategory): HeadlinesPayload {
  const items =
    category === "my-politics" || category === "world-politics"
      ? POLITICS_FALLBACK
      : category === "global-economy"
        ? GLOBAL_FALLBACK
        : MARKET_FALLBACK.map((item) => ({
            id: item.id,
            title: item.headline,
            publisher: item.source,
            url: item.url,
            publishedAt: item.publishedAt,
            tag: item.tag,
            snippet: item.snippet,
          }));

  return {
    source: "cache",
    category,
    label: categoryLabel(category),
    asOf: new Date().toISOString(),
    items,
    errors: [`live-wire-unavailable:${NEWS_WINDOW_DAYS}d`],
  };
}
