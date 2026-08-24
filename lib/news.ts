import "server-only";

import { fetchRss, googleNewsUrl, headlineKey, stripPublisherSuffix } from "./rss";
import { usableArticleText } from "./eli5";
import type { NewsItem, NewsPayload } from "./types";

/**
 * Local market news via Google News RSS. Google aggregates the Malaysian
 * newswires (The Edge, The Star, NST, Bernama) and names the originating
 * publisher per item, which no local outlet exposes through a free API.
 */

const PER_FEED_LIMIT = 25;
const MAX_ITEMS = 45;

const FEEDS = [
  googleNewsUrl("Bursa Malaysia stock news", { withinDays: 7 }),
  googleNewsUrl("Malaysia KLCI ringgit stock market", { withinDays: 7 }),
  googleNewsUrl("Malaysia listed company earnings banking property plantation", { withinDays: 7 }),
];

const FALLBACK_TAG = "#Markets";

/**
 * Quote-page republishers leak into the search feed as headlines that are just
 * a ticker, e.g. "$FTSE Bursa Malaysia KLCI Index (.KLSE.MY)$".
 */
const NOISE_PATTERN = /^\$.+\$$/;

export function isNoiseHeadline(headline: string): boolean {
  return NOISE_PATTERN.test(headline);
}

/**
 * First match wins, so sector buckets are ordered ahead of the broader
 * "#Policy" and "#Earnings" catch-alls: a Maybank results story should file
 * under #Banking rather than #Earnings.
 */
const TAG_RULES: Array<{ tag: string; keywords: string[] }> = [
  {
    tag: "#Banking",
    keywords: [
      "maybank",
      "cimb",
      "public bank",
      "rhb",
      "hong leong bank",
      "ambank",
      "affin",
      "alliance bank",
      "bank islam",
      "banking",
      "lender",
      "loan growth",
      "insurer",
      "insurance",
      "takaful",
      "fintech",
    ],
  },
  {
    tag: "#Property",
    keywords: [
      "property",
      "real estate",
      "reit",
      "sp setia",
      "mah sing",
      "eco world",
      "sime darby property",
      "ioi properties",
      "township",
      "housing",
      "office space",
      "land deal",
    ],
  },
  {
    tag: "#Energy",
    keywords: [
      "petronas",
      "tenaga",
      "oil and gas",
      "crude",
      "petroleum",
      "energy",
      "solar",
      "renewable",
      "power plant",
      "electricity",
      "hibiscus",
      "yinson",
      "dialog group",
    ],
  },
  {
    tag: "#Tech",
    keywords: [
      "semiconductor",
      "chipmaker",
      "data centre",
      "data center",
      "inari",
      "vitrox",
      "unisem",
      "greatech",
      "automation",
      "artificial intelligence",
      "technology",
      "cloud",
    ],
  },
  {
    tag: "#Plantation",
    keywords: [
      "palm oil",
      "crude palm",
      "plantation",
      "sd guthrie",
      "kuala lumpur kepong",
      "ioi corp",
      "fgv",
      "rubber",
      "commodity",
    ],
  },
  {
    tag: "#Healthcare",
    keywords: ["healthcare", "hospital", "ihh", "kpj", "glove", "pharmaceutical", "medical"],
  },
  {
    tag: "#Construction",
    keywords: [
      "construction",
      "gamuda",
      "infrastructure",
      "contract award",
      "mrt",
      "lrt",
      "highway",
      "ecrl",
      "builder",
    ],
  },
  {
    tag: "#Telco",
    keywords: ["celcomdigi", "maxis", "axiata", "telekom malaysia", "telco", "spectrum", "5g"],
  },
  {
    tag: "#Transport",
    keywords: [
      "airasia",
      "capital a",
      "airport",
      "aviation",
      "airline",
      "westports",
      "logistics",
      "shipping",
      "port operator",
    ],
  },
  {
    tag: "#Consumer",
    keywords: ["retail", "consumer", "nestle", "mr diy", "speed mart", "food and beverage", "brewer"],
  },
  { tag: "#IPO", keywords: ["ipo", "listing debut", "ace market", "leap market", "prospectus"] },
  {
    tag: "#Policy",
    keywords: [
      "bank negara",
      "bnm",
      "opr",
      "monetary policy",
      "interest rate",
      "budget",
      "subsidy",
      "subsidies",
      "tariff",
      "ministry of finance",
      "prime minister",
      "anwar",
      "government",
      "parliament",
      "inflation",
      "gdp",
      "fiscal",
      "policy",
      "ringgit",
    ],
  },
  {
    tag: "#Earnings",
    keywords: ["net profit", "quarterly results", "earnings", "revenue", "dividend", "profit"],
  },
];

/** Shared with the per-company feed so both news surfaces label stories the same way. */
export function classifyHeadline(headline: string, summary: string | null = null): string {
  const haystack = `${headline} ${summary ?? ""}`.toLowerCase();

  for (const rule of TAG_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.tag;
    }
  }
  return FALLBACK_TAG;
}

export function rankTags(items: NewsItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.tag, (counts.get(item.tag) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

async function loadFeed(url: string, errors: string[]): Promise<NewsItem[]> {
  try {
    const entries = await fetchRss(url, PER_FEED_LIMIT);

    return entries.map((entry) => {
      const headline = stripPublisherSuffix(entry.title, entry.publisher);
      return {
        id: entry.guid ?? entry.link ?? headlineKey(headline),
        tag: classifyHeadline(headline, entry.summary),
        headline,
        source: entry.publisher ?? "Google News",
        url: entry.link,
        publishedAt: entry.publishedAt,
        snippet: usableArticleText(entry.summary, headline),
      } satisfies NewsItem;
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    errors.push(detail);
    return [];
  }
}

export async function getNewsSnapshot(): Promise<NewsPayload> {
  const errors: string[] = [];
  const feeds = await Promise.all(FEEDS.map((url) => loadFeed(url, errors)));

  const seen = new Set<string>();
  const items: NewsItem[] = [];

  for (const item of feeds.flat()) {
    const key = headlineKey(item.headline);
    if (key.length === 0 || seen.has(key) || isNoiseHeadline(item.headline)) continue;
    seen.add(key);
    items.push(item);
  }

  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const trimmed = items.slice(0, MAX_ITEMS);

  if (trimmed.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    source: "google-news",
    asOf: new Date().toISOString(),
    items: trimmed,
    tags: rankTags(trimmed),
    errors,
  };
}
