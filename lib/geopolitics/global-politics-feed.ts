import "server-only";

import { categoryLabel } from "@/lib/categories";
import { matchHeadlineCountries } from "@/lib/geopolitics/analyze";
import { GEOPOLITICAL_COUNTRIES } from "@/lib/geopolitics/countries";
import type { GlobalPoliticsNewsPayload } from "@/lib/geopolitics/types";
import {
  fetchRssWithFallback,
  googleNewsUrl,
  headlineKey,
  reutersWorldRss,
  stripPublisherSuffix,
  yahooNewsRss,
} from "@/lib/rss";
import { usableArticleText } from "@/lib/eli5";
import { isNoiseHeadline } from "@/lib/news";
import { NEWS_WINDOW_DAYS } from "@/lib/news-window";
import type { Headline } from "@/lib/types";

const PER_FEED_LIMIT = 40;
const MAX_ITEMS = 180;

const DIRECT_RSS_FEEDS = [
  reutersWorldRss(),
  yahooNewsRss("world"),
  yahooNewsRss("politics"),
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://www.aljazeera.com/xml/rss/all.xml",
  "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
];

const WORLD_QUERIES = [
  "world politics geopolitics diplomacy summit when:7d",
  "global election sanctions conflict treaty when:7d",
  "United Nations Security Council briefing when:7d",
  "international relations foreign policy when:7d",
];

const ANCHOR_COUNTRY_QUERIES = GEOPOLITICAL_COUNTRIES.slice(0, 28).map(
  (country) => `${country.name} politics diplomacy when:7d`,
);

function dedupeKey(item: Headline): string {
  if (item.url) return item.url.trim().toLowerCase();
  return headlineKey(item.title);
}

async function loadDirectFeed(url: string, errors: string[]): Promise<Headline[]> {
  const entries = await fetchRssWithFallback([url], PER_FEED_LIMIT, errors);
  return entries.map((entry) => {
    const title = stripPublisherSuffix(entry.title, entry.publisher);
    return {
      id: entry.guid ?? entry.link ?? headlineKey(title),
      title,
      publisher: entry.publisher,
      url: entry.link,
      publishedAt: entry.publishedAt,
      tag: "#Geopolitics",
      snippet: usableArticleText(entry.summary, title),
    } satisfies Headline;
  });
}

async function loadGoogleQuery(query: string, errors: string[]): Promise<Headline[]> {
  const url = googleNewsUrl(query, { edition: "WORLD", withinDays: NEWS_WINDOW_DAYS });
  return loadDirectFeed(url, errors);
}

export async function fetchGlobalPoliticsNews(): Promise<GlobalPoliticsNewsPayload> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: Headline[] = [];
  const byIso2: Record<string, Headline[]> = {};

  function take(item: Headline) {
    const key = dedupeKey(item);
    if (key.length === 0 || seen.has(key) || isNoiseHeadline(item.title)) return;
    seen.add(key);
    items.push(item);

    const countries = matchHeadlineCountries(`${item.title} ${item.snippet ?? ""}`);
    for (const iso2 of countries) {
      if (!byIso2[iso2]) byIso2[iso2] = [];
      byIso2[iso2].push(item);
    }
  }

  const batches = await Promise.all([
    ...DIRECT_RSS_FEEDS.map((url) => loadDirectFeed(url, errors)),
    ...WORLD_QUERIES.map((query) => loadGoogleQuery(query, errors)),
    ...ANCHOR_COUNTRY_QUERIES.map((query) => loadGoogleQuery(query, errors)),
  ]);

  for (const batch of batches) {
    for (const item of batch) take(item);
  }

  items.sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const trimmed = items.slice(0, MAX_ITEMS);

  for (const iso2 of Object.keys(byIso2)) {
    byIso2[iso2] = byIso2[iso2]
      .filter((item) => trimmed.some((row) => row.id === item.id))
      .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  }

  if (trimmed.length === 0 && errors.length > 0) {
    throw new Error("global-politics-wire-unavailable");
  }

  return {
    source: "google-news",
    category: "world-politics",
    label: categoryLabel("world-politics"),
    asOf: new Date().toISOString(),
    items: trimmed,
    byIso2,
    errors,
    matchedCountries: Object.keys(byIso2).length,
  };
}
