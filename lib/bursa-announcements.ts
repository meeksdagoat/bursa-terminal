import "server-only";

import { fetchHtml, fetchRss, googleNewsUrl, headlineKey, stripPublisherSuffix } from "./rss";
import type {
  AnnouncementCategory,
  BursaAnnouncement,
  BursaAnnouncementsPayload,
  UniverseEntry,
} from "./types";

const PER_FEED = 24;
const MAX_ITEMS = 30;

const CATEGORY_RULES: Array<{ category: AnnouncementCategory; keywords: string[] }> = [
  {
    category: "Financial Result",
    keywords: [
      "quarterly rpt",
      "quarterly report",
      "financial results",
      "annual audited",
      "half yearly",
      "unaudited",
    ],
  },
  {
    category: "Shareholding Change",
    keywords: [
      "substantial",
      "sub. s-hldr",
      "section 138",
      "changes in shareholdings",
      "share buy",
      "dealings in listed",
    ],
  },
  {
    category: "Dividend",
    keywords: ["dividend", "entitlement", "dps", "interim single"],
  },
  {
    category: "Board Change",
    keywords: ["director", "section 219", "chief executive", "appointment of", "board of directors"],
  },
  {
    category: "Additional Listing",
    keywords: ["additional listing", "subdivision", "bonus issue", "rights issue"],
  },
  {
    category: "General Announcement",
    keywords: ["general announcement", "others", "transactions", "related party"],
  },
];

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function classifyAnnouncement(title: string, haystack = title): AnnouncementCategory {
  const text = haystack.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.category;
  }
  return "Other";
}

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseClock(label: string): { hours: number; minutes: number } | null {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const pm = match[3].toLowerCase() === "pm";
  if (pm && hours < 12) hours += 12;
  if (!pm && hours === 12) hours = 0;
  return { hours, minutes };
}

function toIso(day: string, clock: { hours: number; minutes: number } | null): string | null {
  const time = clock
    ? `${String(clock.hours).padStart(2, "0")}:${String(clock.minutes).padStart(2, "0")}:00`
    : "16:00:00";
  const iso = `${day}T${time}+08:00`;
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
}

function parseNearbyDate(window: string): string | null {
  const clock = parseClock(window);
  const isoDay =
    window.match(/datetime="(\d{4}-\d{2}-\d{2})"/)?.[1] ??
    window.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (isoDay) return toIso(isoDay, clock);

  const short = window.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
  if (!short) return null;
  const month = MONTHS[short[2].toLowerCase()];
  if (month == null) return null;
  const year = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" });
  const day = `${year}-${String(month + 1).padStart(2, "0")}-${String(Number(short[1])).padStart(2, "0")}`;
  const iso = toIso(day, clock);
  if (!iso) return null;
  if (new Date(iso).getTime() > Date.now() + 12 * 60 * 60 * 1000) {
    const prior = `${Number(year) - 1}-${String(month + 1).padStart(2, "0")}-${String(Number(short[1])).padStart(2, "0")}`;
    return toIso(prior, clock);
  }
  return iso;
}

function field(html: string, className: string): string {
  const match = html.match(new RegExp(`class="${className}[^"]*"[^>]*>([\\s\\S]*?)</`, "i"));
  return match ? decode(match[1]) : "";
}

function parseListingCards(html: string): BursaAnnouncement[] {
  const items: BursaAnnouncement[] = [];
  const seen = new Set<string>();
  const marker = 'class="announcement-item"';
  let from = 0;

  while (from < html.length) {
    const idx = html.indexOf(marker, from);
    if (idx < 0) break;
    from = idx + marker.length;

    const tagStart = html.lastIndexOf("<a", idx);
    if (tagStart < 0) continue;
    const href = html
      .slice(tagStart, idx)
      .match(/href="([^"]*\/v2\/announcements\/view\/\d+)"/i)?.[1];
    if (!href) continue;

    const end = html.indexOf("</a>", idx);
    const body = end > idx ? html.slice(idx, end) : html.slice(idx, idx + 2_000);
    const heading = field(body, "title");
    const snippet = field(body, "snippet");
    const title = [heading, snippet].filter((part) => part.length > 0).join(" ").replace(/\s+/g, " ").trim();
    if (title.length < 8) continue;

    const url = href.startsWith("http") ? href : `https://www.klsescreener.com${href}`;
    if (seen.has(url)) continue;
    seen.add(url);

    const categoryTag = field(body, "category-tag");
    const stamp = [field(body, "day"), field(body, "month"), field(body, "time-ago")]
      .filter(Boolean)
      .join(" ");

    items.push({
      id: url,
      category: classifyAnnouncement(title, `${title} ${categoryTag}`),
      title,
      url,
      publishedAt: parseNearbyDate(stamp) ?? parseNearbyDate(decode(body)),
      source: "Bursa via KLSE Screener",
    });
  }

  return items;
}

function parseAnnouncementLinks(html: string): BursaAnnouncement[] {
  const items: BursaAnnouncement[] = [];
  const seen = new Set<string>();
  const pattern =
    /<a[^>]*href="([^"]*\/v2\/announcements\/view\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (let match = pattern.exec(html); match !== null; match = pattern.exec(html)) {
    const href = match[1].startsWith("http")
      ? match[1]
      : `https://www.klsescreener.com${match[1]}`;
    if (seen.has(href)) continue;

    const rawTitle = decode(match[2]);
    if (rawTitle.length < 8 || rawTitle.toLowerCase() === "view") continue;

    const window = html.slice(Math.max(0, match.index - 500), match.index + match[0].length + 280);
    const haystack = `${rawTitle} ${decode(window)}`;
    const afterClock = rawTitle.match(/\d{1,2}:\d{2}\s*(?:am|pm)\s+(.+)$/i);
    const title = (afterClock?.[1] ?? rawTitle).trim();
    seen.add(href);
    items.push({
      id: href,
      category: classifyAnnouncement(title, haystack),
      title,
      url: href,
      publishedAt: parseNearbyDate(haystack),
      source: "Bursa via KLSE Screener",
    });
  }

  return items;
}

function parseAnnouncements(html: string): BursaAnnouncement[] {
  const cards = parseListingCards(html);
  return cards.length > 0 ? cards : parseAnnouncementLinks(html);
}

async function loadScreener(code: string): Promise<BursaAnnouncement[]> {
  const [listing, snapshot] = await Promise.all([
    fetchHtml(`https://www.klsescreener.com/v2/announcements/stock/${code}`, 25_000, {
      Referer: `https://www.klsescreener.com/v2/stocks/view/${code}`,
    })
      .then(parseAnnouncements)
      .catch(() => [] as BursaAnnouncement[]),
    fetchHtml(`https://www.klsescreener.com/v2/stocks/view/${code}`, 25_000)
      .then(parseAnnouncements)
      .catch(() => [] as BursaAnnouncement[]),
  ]);
  return mergeAnnouncements([...listing, ...snapshot]);
}

async function loadGoogleNews(entry: UniverseEntry): Promise<BursaAnnouncement[]> {
  const url = googleNewsUrl(
    `"${entry.name}" ${entry.code} (Bursa OR announcement OR "quarterly report" OR "substantial shareholder" OR dividend OR entitlement)`,
    { withinDays: 120 },
  );
  const entries = await fetchRss(url, PER_FEED);
  return entries.map((item) => {
    const title = stripPublisherSuffix(item.title, item.publisher);
    return {
      id: item.guid ?? item.link ?? headlineKey(title),
      category: classifyAnnouncement(title),
      title,
      url: item.link,
      publishedAt: item.publishedAt,
      source: item.publisher ?? "Google News",
    } satisfies BursaAnnouncement;
  });
}

function mergeAnnouncements(items: BursaAnnouncement[]): BursaAnnouncement[] {
  const seen = new Set<string>();
  const unique: BursaAnnouncement[] = [];

  for (const item of items) {
    const key = item.url ?? item.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  unique.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return unique.slice(0, MAX_ITEMS);
}

export async function getBursaAnnouncements(
  entry: UniverseEntry,
): Promise<BursaAnnouncementsPayload> {
  const errors: string[] = [];
  const screener = await loadScreener(entry.code).catch((error: unknown) => {
    errors.push(error instanceof Error ? error.message : String(error));
    return [] as BursaAnnouncement[];
  });

  const news =
    screener.length > 0
      ? []
      : await loadGoogleNews(entry).catch((error: unknown) => {
          errors.push(error instanceof Error ? error.message : String(error));
          return [] as BursaAnnouncement[];
        });

  const items = mergeAnnouncements([...screener, ...news]);
  if (items.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    source: screener.length > 0 ? "bursa" : "google-news",
    symbol: entry.symbol,
    company: entry.name,
    asOf: new Date().toISOString(),
    items,
  };
}
