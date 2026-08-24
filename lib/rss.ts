import "server-only";

/**
 * Minimal RSS 2.0 reader. Google News and the local newswires emit flat,
 * well-formed channels, so a dependency-free extractor is enough and keeps the
 * server bundle free of an XML parser.
 */

export type RssItem = {
  title: string;
  link: string | null;
  /** Publisher name from <source>, which Google News fills with the originating outlet. */
  publisher: string | null;
  summary: string | null;
  publishedAt: string | null;
  guid: string | null;
};

const REQUEST_TIMEOUT_MS = 8000;

// Google News serves an empty channel to clients that look automated.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ITEM_PATTERN = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;

const FIELD_PATTERNS = {
  title: /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i,
  link: /<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i,
  source: /<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i,
  description: /<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i,
  pubDate: /<pubDate(?:\s[^>]*)?>([\s\S]*?)<\/pubDate>/i,
  guid: /<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i,
} as const;

const CDATA_PATTERN = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;
const ENTITY_PATTERN = /&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;
const HAS_ENTITY = /&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  hellip: "\u2026",
};

function decodeOnce(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    const token = entity.toLowerCase();

    if (token.startsWith("#x")) {
      const code = Number.parseInt(token.slice(2), 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    if (token.startsWith("#")) {
      const code = Number.parseInt(token.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[token] ?? match;
  });
}

/**
 * Google News double-escapes publisher names (`&amp;#39;`), so one pass is not
 * enough. Two is the observed maximum; more passes would start mangling
 * headlines that legitimately contain an escaped ampersand.
 */
function decodeEntities(value: string): string {
  const once = decodeOnce(value);
  return HAS_ENTITY.test(once) ? decodeOnce(once) : once;
}

function field(block: string, name: keyof typeof FIELD_PATTERNS): string | null {
  const match = FIELD_PATTERNS[name].exec(block);
  if (!match) return null;

  const cdata = CDATA_PATTERN.exec(match[1]);
  const text = decodeEntities(cdata ? cdata[1] : match[1])
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0 ? text : null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function parseRss(xml: string, limit: number): RssItem[] {
  const items: RssItem[] = [];
  ITEM_PATTERN.lastIndex = 0;

  for (let match = ITEM_PATTERN.exec(xml); match !== null; match = ITEM_PATTERN.exec(xml)) {
    if (items.length >= limit) break;

    const block = match[1];
    const title = field(block, "title");
    if (!title) continue;

    items.push({
      title,
      link: field(block, "link"),
      publisher: field(block, "source"),
      summary: field(block, "description"),
      publishedAt: toIsoDate(field(block, "pubDate")),
      guid: field(block, "guid"),
    });
  }

  return items;
}

export async function fetchRss(url: string, limit: number): Promise<RssItem[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`feed responded ${response.status}`);
  }

  return parseRss(await response.text(), limit);
}

export async function fetchHtml(
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      ...extraHeaders,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`page responded ${response.status}`);
  }

  return response.text();
}

const EDITIONS = {
  /** Malaysian English edition — ranks local newswires first. */
  MY: { hl: "en-MY", gl: "MY", ceid: "MY:en" },
  /** International English edition, for stories that are not Malaysia-specific. */
  WORLD: { hl: "en-US", gl: "US", ceid: "US:en" },
} as const;

export type NewsEdition = keyof typeof EDITIONS;

/**
 * Google News search feed. `withinDays` maps to the `when:` operator, which is
 * what keeps a query returning current stories rather than an all-time ranking.
 */
export function googleNewsUrl(
  query: string,
  { edition = "MY", withinDays }: { edition?: NewsEdition; withinDays?: number } = {},
): string {
  const { hl, gl, ceid } = EDITIONS[edition];
  const scoped = withinDays ? `${query} when:${withinDays}d` : query;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(scoped)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/**
 * Comparison form for headline/company matching: accent-folded, lowercase and
 * reduced to alphanumeric words, so "Nestlé Malaysia" and "Nestle (Malaysia)"
 * collapse to the same string.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Google News appends " - Publisher" to every headline; the badge already shows it. */
export function stripPublisherSuffix(title: string, publisher: string | null): string {
  if (!publisher) return title;
  const suffix = ` - ${publisher}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

/** Collapses headlines to a comparison key so overlapping queries de-duplicate. */
export function headlineKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
