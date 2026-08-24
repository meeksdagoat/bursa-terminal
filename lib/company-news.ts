import "server-only";

import { classifyHeadline, isNoiseHeadline, rankTags } from "./news";
import { usableArticleText } from "./eli5";
import {
  fetchRss,
  googleNewsUrl,
  headlineKey,
  normalizeText,
  stripPublisherSuffix,
} from "./rss";
import type { CompanyNewsPayload, NewsItem, UniverseEntry } from "./types";
import { fetchTickerNews } from "./yahoo";

/**
 * Single-company news. Google News is queried on the name the press actually
 * uses, then every headline is checked for that name before it is shown, so a
 * ticker's panel cannot fill up with unrelated sector stories.
 */

const PER_FEED_LIMIT = 20;
const MAX_ITEMS = 24;

/**
 * Aliases for names where the exchange short name is not what newsrooms print:
 * abbreviations, renamed listings, and holdings whose bare first word would
 * collide with a sibling counter. First entry drives the search query; every
 * entry is accepted when matching headlines.
 */
const PRESS_NAMES: Record<string, string[]> = {
  "1155.KL": ["Maybank", "Malayan Banking"],
  "1023.KL": ["CIMB"],
  "1066.KL": ["RHB Bank", "RHB"],
  "1015.KL": ["AmBank", "AMMB"],
  "1171.KL": ["MBSB Bank", "MBSB"],
  "1818.KL": ["Bursa Malaysia Berhad", "Bursa Malaysia"],
  "5185.KL": ["Affin Bank", "Affin"],
  "6139.KL": ["Syarikat Takaful Malaysia", "Takaful Malaysia"],
  "5301.KL": ["CTOS Digital", "CTOS"],
  "8621.KL": ["LPI Capital"],
  "1163.KL": ["Allianz Malaysia"],
  "6459.KL": ["MNRB Holdings", "MNRB"],
  "5347.KL": ["Tenaga Nasional", "Tenaga", "TNB"],
  "4677.KL": ["YTL Corporation", "YTL Corp"],
  "5183.KL": ["Petronas Chemicals", "PetChem"],
  "5681.KL": ["Petronas Dagangan"],
  "6033.KL": ["Petronas Gas"],
  "5218.KL": ["Vantris Energy", "Vantris", "Sapura Energy"],
  "7277.KL": ["Dialog Group", "Dialog Berhad"],
  "5199.KL": ["Hibiscus Petroleum", "Hibiscus"],
  "2445.KL": ["Kuala Lumpur Kepong", "KLK"],
  "5285.KL": ["SD Guthrie", "Sime Darby Plantation"],
  "1961.KL": ["IOI Corporation", "IOI Corp"],
  "3182.KL": ["Genting Berhad", "Genting Group"],
  "4197.KL": ["Sime Darby Berhad", "Sime Darby"],
  "5211.KL": ["Sunway Berhad", "Sunway Group"],
  "5263.KL": ["Sunway Construction", "SunCon"],
  "3034.KL": ["Hap Seng Consolidated", "Hap Seng"],
  "3395.KL": ["Berjaya Corporation"],
  "5053.KL": ["OSK Holdings"],
  "4707.KL": ["Nestle Malaysia"],
  "3689.KL": ["Fraser & Neave", "F&N"],
  "5296.KL": ["Mr DIY"],
  "5326.KL": ["99 Speedmart", "99 Speed Mart"],
  "4162.KL": ["British American Tobacco", "BAT Malaysia"],
  "3026.KL": ["Dutch Lady"],
  "2836.KL": ["Carlsberg Malaysia", "Carlsberg Brewery"],
  "3255.KL": ["Heineken Malaysia"],
  "6599.KL": ["Aeon Co", "Aeon Berhad"],
  "5139.KL": ["Aeon Credit"],
  "4065.KL": ["PPB Group"],
  "3662.KL": ["Malayan Flour Mills", "MFM"],
  "5202.KL": ["MSM Malaysia", "MSM"],
  "5225.KL": ["IHH Healthcare", "IHH"],
  "5878.KL": ["KPJ Healthcare", "KPJ"],
  "7148.KL": ["Duopharma Biotech", "Duopharma"],
  "3867.KL": ["Malaysian Pacific Industries", "MPI"],
  "0166.KL": ["Inari Amertron", "Inari"],
  "4456.KL": ["Dagang NeXchange", "DNeX"],
  "0138.KL": ["Zetrix AI", "Zetrix", "MyEG"],
  "5292.KL": ["UWC Berhad", "UWC"],
  "5216.KL": ["NEXG Berhad", "NEXG"],
  "5309.KL": ["ITMAX System", "ITMAX"],
  "7204.KL": ["D&O Green Technologies", "D&O"],
  "4863.KL": ["Telekom Malaysia"],
  "6888.KL": ["Axiata"],
  "6399.KL": ["Astro Malaysia", "Astro"],
  "5031.KL": ["Time dotCom"],
  "5398.KL": ["Gamuda"],
  "3336.KL": ["IJM Corporation", "IJM"],
  "3794.KL": ["Malayan Cement"],
  "2852.KL": ["Cahya Mata Sarawak", "CMS"],
  "9679.KL": ["WCT Holdings", "WCT"],
  "8664.KL": ["S P Setia", "SP Setia"],
  "8583.KL": ["Mah Sing"],
  "8206.KL": ["Eco World Development", "Eco World"],
  "5789.KL": ["LBS Bina"],
  "1724.KL": ["Paramount Corporation"],
  "5401.KL": ["Tropicana Corporation"],
  "5606.KL": ["IGB Berhad"],
  "5235SS.KL": ["KLCCP Stapled", "KLCC Property"],
  "5180.KL": ["CapitaLand Malaysia Trust", "CLMT"],
  "3816.KL": ["MISC Berhad", "MISC"],
  "5099.KL": ["Capital A", "AirAsia"],
  "5246.KL": ["Westports"],
  "4634.KL": ["Pos Malaysia"],
  "1619.KL": ["DRB-Hicom"],
  "4405.KL": ["Tan Chong Motor", "Tan Chong"],
  "5015.KL": ["APM Automotive", "APM"],
  "5983.KL": ["MBM Resources", "MBM"],
  "3859.KL": ["Magnum Berhad"],
  "1562.KL": ["Sports Toto"],
  "4502.KL": ["Media Prima"],
  "8869.KL": ["Press Metal"],
  "5665.KL": ["Southern Steel"],
  "1295.KL": ["Public Bank"],
  "2488.KL": ["Alliance Bank"],
  "0200.KL": ["Revenue Group"],
  "7237.KL": ["Power Root"],
  "6432.KL": ["Apollo Food"],
  "0157.KL": ["Focus Point"],
  "5306.KL": ["Farm Fresh"],
  "5236.KL": ["Matrix Concepts"],
  "2089.KL": ["United Plantations"],
  "5126.KL": ["Sarawak Oil Palms"],
};

/** Trailing words that carry no identity, dropped to reach the name in headlines. */
const CORPORATE_SUFFIXES = new Set([
  "berhad",
  "bhd",
  "holdings",
  "holding",
  "group",
  "corp",
  "corporation",
  "company",
  "co",
  "industries",
  "industry",
  "resources",
  "capital",
  "technologies",
  "technology",
  "international",
  "consolidated",
  "development",
  "developments",
  "enterprise",
  "enterprises",
  "systems",
  "system",
]);

/**
 * First words that are too common to stand alone as a company match. Anything
 * listed here keeps its full name; the curated aliases above cover the cases
 * where a short form is genuinely needed.
 */
const AMBIGUOUS_HEADS = new Set([
  "public",
  "alliance",
  "media",
  "revenue",
  "focus",
  "power",
  "apollo",
  "sports",
  "press",
  "southern",
  "malayan",
  "malaysia",
  "malaysian",
  "united",
  "berjaya",
  "genting",
  "sunway",
  "petronas",
  "sime",
  "kuala",
  "bank",
  "bursa",
  "capital",
  "dialog",
  "global",
  "world",
  "first",
  "grand",
  "green",
  "land",
  "city",
  "metro",
  "national",
  "matrix",
  "paramount",
  "tropicana",
  "pavilion",
  "axis",
  "sarawak",
  "harbour",
  "swift",
  "suria",
]);

function aliasesFor(entry: UniverseEntry): string[] {
  const curated = PRESS_NAMES[entry.symbol];
  const aliases = [...(curated ?? [entry.name]), entry.name, entry.code];
  const tokens = entry.name.split(/\s+/).filter((token) => token.length > 0);
  const trimmed = [...tokens];

  while (
    trimmed.length > 1 &&
    CORPORATE_SUFFIXES.has(normalizeText(trimmed[trimmed.length - 1]))
  ) {
    trimmed.pop();
  }

  if (trimmed.length < tokens.length) aliases.push(trimmed.join(" "));

  const head = trimmed[0] ?? "";
  if (head.length >= 5 && !AMBIGUOUS_HEADS.has(normalizeText(head))) aliases.push(head);

  return [...new Set(aliases)];
}

/** Whole-word containment, so "F&N" cannot match inside "of no". */
function namesCompany(text: string, aliases: string[]): boolean {
  const haystack = ` ${normalizeText(text)} `;

  return aliases.some((alias) => {
    const needle = normalizeText(alias);
    return needle.length > 0 && haystack.includes(` ${needle} `);
  });
}

function relatedToCompany(
  text: string,
  relatedTickers: string[] | undefined,
  entry: UniverseEntry,
  aliases: string[],
): boolean {
  if (relatedTickers?.some((ticker) => ticker.toUpperCase() === entry.symbol.toUpperCase())) {
    return true;
  }
  return namesCompany(text, aliases);
}

async function loadFeed(url: string, errors: string[]): Promise<Array<NewsItem & { haystack: string }>> {
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
        haystack: `${headline} ${entry.summary ?? ""}`,
      };
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getCompanyNews(entry: UniverseEntry): Promise<CompanyNewsPayload> {
  const aliases = aliasesFor(entry);
  const query = aliases[0];
  const errors: string[] = [];

  const [yahooNews, ...feeds] = await Promise.all([
    fetchTickerNews(entry.symbol, query).catch((error: unknown) => {
      errors.push(error instanceof Error ? error.message : String(error));
      return [];
    }),
    loadFeed(googleNewsUrl(`"${query}"`, { withinDays: 60 }), errors),
    loadFeed(
      googleNewsUrl(`"${query}" ${entry.code} (Bursa OR Berhad OR shares OR earnings)`, {
        withinDays: 180,
      }),
      errors,
    ),
  ]);

  const seen = new Set<string>();
  const items: NewsItem[] = [];

  function take(item: NewsItem) {
    const key = headlineKey(item.headline);
    if (key.length === 0 || seen.has(key) || isNoiseHeadline(item.headline)) return;
    seen.add(key);
    items.push(item);
  }

  for (const item of yahooNews) {
    if (!relatedToCompany(item.headline, item.relatedTickers, entry, aliases)) continue;
    take({
      id: item.id,
      tag: classifyHeadline(item.headline),
      headline: item.headline,
      source: item.source,
      url: item.url,
      publishedAt: item.publishedAt,
      snippet: item.snippet,
    });
  }

  for (const item of feeds.flat()) {
    if (!namesCompany(item.haystack, aliases)) continue;
    take({
      id: item.id,
      tag: item.tag,
      headline: item.headline,
      source: item.source,
      url: item.url,
      publishedAt: item.publishedAt,
      snippet: item.snippet,
    });
  }

  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const trimmed = items.slice(0, MAX_ITEMS);

  if (trimmed.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    source: "yahoo+google-news",
    asOf: new Date().toISOString(),
    symbol: entry.symbol,
    company: entry.name,
    items: trimmed,
    tags: rankTags(trimmed),
    errors,
  };
}
