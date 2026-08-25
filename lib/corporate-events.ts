import "server-only";

import { getBursaAnnouncements } from "./bursa-announcements";
import { getCompanyNews } from "./company-news";
import {
  classifyEventImpact,
  classifyEventSentiment,
  classifyEventType,
  EVENT_TYPE_LABEL,
} from "./event-classify";
import type {
  BursaAnnouncement,
  CorporateEvent,
  CorporateEventsPayload,
  NewsItem,
  UniverseEntry,
} from "./types";

export { EVENT_TYPE_LABEL };

const MAX_ITEMS = 40;

function eventKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fromAnnouncement(item: BursaAnnouncement): CorporateEvent | null {
  const title = item.title.trim();
  if (title.length < 8) return null;
  const type = classifyEventType(title, item.category);
  const sentiment = classifyEventSentiment(title, item.category);
  return {
    id: item.id,
    date: item.publishedAt ?? new Date().toISOString(),
    type,
    impact: classifyEventImpact(type, sentiment),
    sentiment,
    title,
    summary: `${item.category} filed with Bursa Malaysia.`,
    source: item.source,
    url: item.url,
  };
}

function fromNews(item: NewsItem): CorporateEvent | null {
  const title = item.headline.trim();
  if (title.length < 8) return null;
  const type = classifyEventType(title);
  const sentiment = classifyEventSentiment(title);
  return {
    id: item.id,
    date: item.publishedAt ?? new Date().toISOString(),
    type,
    impact: classifyEventImpact(type, sentiment),
    sentiment,
    title,
    summary: item.snippet ?? item.tag,
    source: item.source,
    url: item.url,
  };
}

export async function getCompanyEvents(entry: UniverseEntry): Promise<CorporateEventsPayload> {
  const errors: string[] = [];

  const [announcements, news] = await Promise.all([
    getBursaAnnouncements(entry).catch((error: unknown) => {
      errors.push(error instanceof Error ? error.message : String(error));
      return null;
    }),
    getCompanyNews(entry).catch((error: unknown) => {
      errors.push(error instanceof Error ? error.message : String(error));
      return null;
    }),
  ]);

  const seen = new Set<string>();
  const items: CorporateEvent[] = [];

  function take(event: CorporateEvent | null) {
    if (!event) return;
    const key = eventKey(event.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push(event);
  }

  for (const item of announcements?.items ?? []) take(fromAnnouncement(item));
  for (const item of news?.items ?? []) take(fromNews(item));

  items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const trimmed = items.slice(0, MAX_ITEMS);

  if (trimmed.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const hasBursa = (announcements?.items.length ?? 0) > 0;
  const hasNews = (news?.items.length ?? 0) > 0;
  const source = hasBursa && hasNews ? "bursa+news" : hasBursa ? "bursa" : "news";

  return {
    source,
    symbol: entry.symbol,
    company: entry.name,
    asOf: new Date().toISOString(),
    items: trimmed,
    errors,
  };
}
