import "server-only";

import { categoryLabel, type HeadlineCategory } from "./categories";
import {
  fetchRssWithFallback,
  googleNewsUrl,
  headlineKey,
  reutersBusinessRss,
  reutersWorldRss,
  type NewsEdition,
  stripPublisherSuffix,
  yahooNewsRss,
} from "./rss";
import { usableArticleText } from "./eli5";
import { isNoiseHeadline } from "./news";
import { NEWS_WINDOW_DAYS } from "./news-window";
import type { Headline, HeadlinesPayload } from "./types";

const POLITICS_TAGS: Array<{ tag: string; keywords: string[] }> = [
  { tag: "#JS-SEZ", keywords: ["js-sez", "johor-singapore", "special economic zone", "js sez"] },
  { tag: "#Subsidy", keywords: ["subsidy", "subsidies", "ron95", "diesel subsidy", "targeted subsidy"] },
  { tag: "#Budget", keywords: ["budget", "allocation", "fiscal", "supply bill"] },
  { tag: "#Cabinet", keywords: ["cabinet", "menteri", "minister", "reshuffle", "putrajaya"] },
  { tag: "#Parliament", keywords: ["parliament", "dewan rakyat", "dewan negara", "hansard"] },
  { tag: "#Election", keywords: ["election", "by-election", "ge16", "polls"] },
  { tag: "#Policy", keywords: ["policy", "bill", "act", "reform", "regulation"] },
];

export function tagPoliticsHeadline(title: string): string {
  const haystack = title.toLowerCase();
  for (const rule of POLITICS_TAGS) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.tag;
  }
  return "#Politics";
}

const ECONOMY_TAGS: Array<{ tag: string; keywords: string[] }> = [
  {
    tag: "#BNM",
    keywords: ["bank negara", "bnm", "opr", "monetary policy", "central bank", "interest rate"],
  },
  {
    tag: "#GDP",
    keywords: ["gdp", "economic growth", "gross domestic", "recession", "grew", "expansion"],
  },
  {
    tag: "#Trade",
    keywords: [
      "trade balance",
      "trade surplus",
      "trade deficit",
      "exports",
      "imports",
      "current account",
      "tariff",
      "shipments",
    ],
  },
  {
    tag: "#Inflation",
    keywords: ["inflation", "cpi", "consumer price", "cost of living", "price index"],
  },
  { tag: "#Ringgit", keywords: ["ringgit", "myr", "exchange rate", "currency"] },
  { tag: "#Fiscal", keywords: ["budget", "fiscal", "subsidy", "deficit", "revenue", "tax", "sst"] },
];

function tagEconomyHeadline(title: string): string {
  const haystack = title.toLowerCase();
  for (const rule of ECONOMY_TAGS) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.tag;
  }
  return "#Economy";
}

const GLOBAL_ECONOMY_TAGS: Array<{ tag: string; keywords: string[] }> = [
  { tag: "#FOMC", keywords: ["fomc", "federal open market", "fed meeting", "fomc minutes"] },
  {
    tag: "#Fed",
    keywords: ["federal reserve", "fed funds", "powell", "jackson hole", "fomc"],
  },
  { tag: "#ECB", keywords: ["ecb", "european central bank", "lagarde", "euro zone rate"] },
  { tag: "#BOJ", keywords: ["bank of japan", "boj", "ueda", "yen intervention"] },
  { tag: "#PBOC", keywords: ["pboc", "people's bank of china", "loan prime rate", "lpr"] },
  {
    tag: "#CPI",
    keywords: ["cpi", "consumer price", "inflation", "pce", "core inflation"],
  },
  { tag: "#Oil", keywords: ["brent", "crude oil", "opec", "wti"] },
  { tag: "#Gold", keywords: ["gold", "bullion", "safe haven"] },
  { tag: "#Treasuries", keywords: ["treasury", "10-year", "bond yield", "tnx"] },
];

export function tagGlobalEconomyHeadline(title: string): string {
  const haystack = title.toLowerCase();
  for (const rule of GLOBAL_ECONOMY_TAGS) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.tag;
  }
  return "#Macro";
}

/**
 * Google News answers macro queries with plenty of US, UK and EU prints. The
 * economy desk is a Malaysian desk, so an item has to name the country or one
 * of its institutions to earn a slot.
 */
const MALAYSIA_SIGNALS = [
  "malaysia",
  "malaysian",
  "ringgit",
  "bursa",
  "klci",
  "bank negara",
  "bnm",
  "opr",
  "putrajaya",
  "dosm",
  "kuala lumpur",
  "anwar",
  "madani",
  "myr",
];

function isMalaysianMacro(title: string): boolean {
  const haystack = title.toLowerCase();
  return MALAYSIA_SIGNALS.some((signal) => haystack.includes(signal));
}

/**
 * The outlet-scoped query returns whatever The Edge, Bernama and Malaysiakini
 * publish, business and regional wires included, so an item has to carry a
 * political or policy signal to reach the desk.
 */
const POLITICS_SIGNALS = [
  "cabinet",
  "minister",
  "ministry",
  "parliament",
  "dewan",
  "government",
  "govt",
  "putrajaya",
  "anwar",
  "policy",
  "subsidy",
  "subsidies",
  "budget",
  "sez",
  "election",
  "bill",
  "legislation",
  "regulation",
  "reform",
  "madani",
  "coalition",
  "pakatan",
  "perikatan",
  "bersatu",
  "umno",
  "pkr",
  "prime minister",
  "menteri",
];

function isMalaysianPolitics(title: string): boolean {
  const haystack = title.toLowerCase();
  return POLITICS_SIGNALS.some((signal) => haystack.includes(signal));
}

/**
 * Topic desks for the overview page. Each category fans out over a few Google
 * News queries so a single phrasing cannot decide the whole tab, and every
 * query is windowed with `when:` so the tab reads as a live wire rather than an
 * all-time ranking.
 */

const PER_FEED_LIMIT = 40;
const MAX_ITEMS = 80;

type CategoryFeed = {
  edition: NewsEdition;
  withinDays: number;
  queries: string[];
  /** Topic badge for each item; desks without badges return null. */
  tagger?: (title: string) => string;
  /** Drops off-topic stories that the query still matched. */
  relevant?: (title: string) => boolean;
};

const FEEDS: Record<HeadlineCategory, CategoryFeed> = {
  "my-politics": {
    edition: "MY",
    withinDays: NEWS_WINDOW_DAYS,
    queries: [
      "Malaysia cabinet minister Dewan Rakyat Anwar Putrajaya",
      "Malaysia subsidy RON95 diesel targeted subsidy MOF",
      "Johor Singapore JS-SEZ special economic zone",
      "Malaysia Budget 2027 fiscal allocation parliament",
      // The Edge, Bernama and Malaysiakini carry the policy detail that the
      // wire aggregators summarise, so they get a query of their own.
      "site:theedgemalaysia.com OR site:bernama.com OR site:malaysiakini.com Malaysia cabinet policy",
    ],
    tagger: tagPoliticsHeadline,
    relevant: isMalaysianPolitics,
  },
  "my-economy": {
    edition: "MY",
    withinDays: NEWS_WINDOW_DAYS,
    queries: [
      "Bank Negara Malaysia OPR monetary policy statement",
      "Malaysia GDP growth quarterly DOSM",
      "Malaysia trade balance exports imports surplus",
      "Malaysia inflation CPI ringgit fiscal deficit",
    ],
    tagger: tagEconomyHeadline,
    relevant: isMalaysianMacro,
  },
  "global-economy": {
    edition: "WORLD",
    withinDays: NEWS_WINDOW_DAYS,
    queries: [
      "FOMC Federal Reserve interest rate Powell",
      "United States CPI inflation consumer prices BLS",
      "ECB European Central Bank Lagarde deposit rate",
      "Bank of Japan BOJ policy rate yen",
      "PBOC China loan prime rate LPR",
      "US 10-year Treasury yield S&P 500 Nasdaq Brent gold",
    ],
    tagger: tagGlobalEconomyHeadline,
  },
  "world-politics": {
    edition: "WORLD",
    withinDays: NEWS_WINDOW_DAYS,
    queries: [
      "world politics geopolitics diplomacy summit",
      "United States China European Union foreign policy relations",
      "global election government sanctions conflict treaty",
    ],
  },
};

const BACKUPS: Record<HeadlineCategory, string[]> = {
  "my-politics": [yahooNewsRss("politics"), yahooNewsRss("malaysia"), reutersWorldRss()],
  "my-economy": [yahooNewsRss("malaysia"), yahooNewsRss("business"), reutersBusinessRss()],
  "global-economy": [yahooNewsRss("business"), yahooNewsRss("world"), reutersBusinessRss()],
  "world-politics": [yahooNewsRss("world"), yahooNewsRss("politics"), reutersWorldRss()],
};

async function loadFeed(
  url: string,
  errors: string[],
  tagger: (title: string) => string | null,
): Promise<Headline[]> {
  const entries = await fetchRssWithFallback([url], PER_FEED_LIMIT, errors);

  return entries.map((entry) => {
    const title = stripPublisherSuffix(entry.title, entry.publisher);
    return {
      id: entry.guid ?? entry.link ?? headlineKey(title),
      title,
      publisher: entry.publisher,
      url: entry.link,
      publishedAt: entry.publishedAt,
      tag: tagger(title),
      snippet: usableArticleText(entry.summary, title),
    } satisfies Headline;
  });
}

export async function getHeadlines(category: HeadlineCategory): Promise<HeadlinesPayload> {
  const { edition, withinDays, queries, tagger, relevant } = FEEDS[category];
  const errors: string[] = [];
  const tag = tagger ?? (() => null);

  const feeds = await Promise.all(
    queries.map((query) => loadFeed(googleNewsUrl(query, { edition, withinDays }), errors, tag)),
  );

  const seen = new Set<string>();
  const items: Headline[] = [];

  function take(item: Headline) {
    const key = headlineKey(item.title);
    if (key.length === 0 || seen.has(key) || isNoiseHeadline(item.title)) return;
    if (relevant && !relevant(item.title)) return;
    seen.add(key);
    items.push(item);
  }

  for (const item of feeds.flat()) take(item);

  if (items.length === 0) {
    const backups = await Promise.all(
      BACKUPS[category].map((url) => loadFeed(url, errors, tag)),
    );
    for (const item of backups.flat()) {
      const key = headlineKey(item.title);
      if (key.length === 0 || seen.has(key) || isNoiseHeadline(item.title)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const trimmed = items.slice(0, MAX_ITEMS);

  if (trimmed.length === 0 && errors.length > 0) {
    throw new Error("live-wire-unavailable");
  }

  return {
    source: "google-news",
    category,
    label: categoryLabel(category),
    asOf: new Date().toISOString(),
    items: trimmed,
    errors,
  };
}
