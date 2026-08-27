import "server-only";

import { fetchRss, googleNewsUrl, headlineKey, stripPublisherSuffix } from "./rss";
import { NEWS_WINDOW_DAYS } from "./news-window";
import type { MacroItem, MacroPayload, MacroSource } from "./types";

/**
 * Policy and macro headlines, one Google News query per institution so each
 * item carries a trustworthy source badge instead of a guessed one. The OPR
 * level itself stays on the live BNM Open API feed (see lib/bnm.ts).
 */

const PER_FEED_LIMIT = 12;
const PER_SOURCE_ITEMS = 6;
const MAX_ITEMS = 24;

const FEEDS: Array<{ source: MacroSource; query: string }> = [
  { source: "BNM", query: "Bank Negara Malaysia monetary policy OPR ringgit reserves" },
  { source: "MOF", query: "Ministry of Finance Malaysia budget fiscal deficit revenue" },
  { source: "PM", query: "Prime Minister Malaysia Anwar Ibrahim economy investment" },
  { source: "POLICY", query: "Malaysia economic policy GDP inflation trade exports" },
];

async function loadFeed(
  source: MacroSource,
  query: string,
  errors: string[],
): Promise<MacroItem[]> {
  try {
    const entries = await fetchRss(googleNewsUrl(query, { withinDays: NEWS_WINDOW_DAYS }), PER_FEED_LIMIT);

    return entries.slice(0, PER_SOURCE_ITEMS).map((entry) => {
      const title = stripPublisherSuffix(entry.title, entry.publisher);
      return {
        id: entry.guid ?? entry.link ?? `${source}:${headlineKey(title)}`,
        source,
        title,
        publisher: entry.publisher,
        url: entry.link,
        publishedAt: entry.publishedAt,
      } satisfies MacroItem;
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    errors.push(`${source}: ${detail}`);
    return [];
  }
}

export async function getMacroSnapshot(): Promise<MacroPayload> {
  const errors: string[] = [];
  const feeds = await Promise.all(FEEDS.map(({ source, query }) => loadFeed(source, query, errors)));

  const seen = new Set<string>();
  const items: MacroItem[] = [];

  for (const item of feeds.flat()) {
    const key = headlineKey(item.title);
    if (key.length === 0 || seen.has(key)) continue;
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
    errors,
  };
}
