import "server-only";

import { fetchHtml, fetchRss, googleNewsUrl, headlineKey, stripPublisherSuffix } from "./rss";
import type { Filing, FilingCategory, FilingsPayload, UniverseEntry } from "./types";
import { NEWS_WINDOW_DAYS } from "./news-window";

const PER_FEED = 40;
const MAX_ITEMS = 80;

const CATEGORY_RULES: Array<{ category: FilingCategory; keywords: string[] }> = [
  {
    category: "QR",
    keywords: ["quarterly rpt", "quarterly report", "financial results", "annual audited", "half yearly"],
  },
  {
    category: "IA",
    keywords: [
      "substantial",
      "sub. s-hldr",
      "section 138",
      "changes in shareholdings",
      "share buy",
    ],
  },
  {
    category: "BOARD",
    keywords: ["director", "section 219", "board", "chief executive", "appointment of"],
  },
  {
    category: "DIV",
    keywords: ["dividend", "entitlement", "dps", "interim single"],
  },
  {
    category: "AL",
    keywords: ["additional listing", "subdivision", "bonus issue", "rights issue"],
  },
  {
    category: "GA",
    keywords: ["general announcement", "others", "transactions", "related party"],
  },
];

export function classifyFiling(title: string): FilingCategory {
  const haystack = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.category;
  }
  return "OTHER";
}

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScreener(html: string): Filing[] {
  const items: Filing[] = [];
  const start = html.indexOf("Recent Announcements");
  const slice = start >= 0 ? html.slice(start, start + 120_000) : html;
  const pattern =
    /<li class="list-group-item[\s\S]*?href="([^"]*\/v2\/announcements\/view\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<time datetime="([^"]+)"[\s\S]*?<\/li>/gi;

  for (let match = pattern.exec(slice); match !== null; match = pattern.exec(slice)) {
    const href = match[1].startsWith("http")
      ? match[1]
      : `https://www.klsescreener.com${match[1]}`;
    const title = decode(match[2]);
    if (title.length < 8 || title.toLowerCase() === "view") continue;

    const day = match[3];
    const publishedAt = Number.isNaN(Date.parse(`${day}T00:00:00+08:00`))
      ? null
      : new Date(`${day}T16:00:00+08:00`).toISOString();

    items.push({
      id: href,
      category: classifyFiling(title),
      title,
      url: href,
      publishedAt,
      source: "Bursa via KLSE Screener",
    });
  }

  return items;
}

async function loadScreener(code: string, errors: string[]): Promise<Filing[]> {
  try {
    const html = await fetchHtml(`https://www.klsescreener.com/v2/stocks/view/${code}`, 25_000);
    return parseScreener(html);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function loadNews(entry: UniverseEntry, errors: string[]): Promise<Filing[]> {
  try {
    const url = googleNewsUrl(
      `"${entry.name}" (Bursa OR announcement OR "quarterly report" OR "substantial shareholder" OR dividend OR entitlement)`,
      { withinDays: NEWS_WINDOW_DAYS },
    );
    const entries = await fetchRss(url, PER_FEED);
    return entries.map((item) => {
      const title = stripPublisherSuffix(item.title, item.publisher);
      return {
        id: item.guid ?? item.link ?? headlineKey(title),
        category: classifyFiling(title),
        title,
        url: item.link,
        publishedAt: item.publishedAt,
        source: item.publisher ?? "Google News",
      } satisfies Filing;
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getCompanyFilings(entry: UniverseEntry): Promise<FilingsPayload> {
  const errors: string[] = [];
  const [screener, news] = await Promise.all([
    loadScreener(entry.code, errors),
    loadNews(entry, errors),
  ]);

  const seen = new Set<string>();
  const items: Filing[] = [];

  for (const item of screener.length > 0 ? screener : news) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    symbol: entry.symbol,
    company: entry.name,
    asOf: new Date().toISOString(),
    items: trimmed,
    errors,
  };
}
