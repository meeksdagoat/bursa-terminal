import "server-only";

import { fetchHtml } from "./rss";
import type {
  AnnouncementDetailPayload,
  AnnouncementKind,
  AnnouncementsPayload,
  MarketAnnouncement,
  UniverseEntry,
} from "./types";
import { universe } from "./universe";

const LIST_URL = "https://www.klsescreener.com/v2/announcements";
const VIEW_BASE = "https://www.klsescreener.com/v2/announcements/view";
const BURSA_DETAILS =
  "https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=";
const FILE_HOST = "https://disclosure.bursamalaysia.com";
const MAX_ITEMS = 40;
const LIST_TTL_MS = 2 * 60 * 1000;

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

const TAG_KIND: Record<string, { filingType: string; kind: AnnouncementKind }> = {
  FA: { filingType: "Quarterly Report", kind: "financial" },
  FRCO: { filingType: "Quarterly Report", kind: "financial" },
  AA: { filingType: "Annual Audited Account", kind: "financial" },
  AACO: { filingType: "Annual Audited Account", kind: "financial" },
  AR: { filingType: "Annual Report", kind: "financial" },
  ARCO: { filingType: "Annual Report", kind: "financial" },
  EA: { filingType: "Dividend Entitlement", kind: "dividend" },
  ENCO: { filingType: "Dividend Entitlement", kind: "dividend" },
  DRCO: { filingType: "Director Dealings", kind: "director" },
  CI: { filingType: "Director Changes", kind: "director" },
  COCI: { filingType: "Director Changes", kind: "director" },
  SH: { filingType: "Shareholding Change", kind: "other" },
  CHSH: { filingType: "Shareholding Change", kind: "other" },
  GA: { filingType: "General Announcement", kind: "other" },
  GACO: { filingType: "General Announcement", kind: "other" },
  AL: { filingType: "Additional Listing", kind: "other" },
  ALCO: { filingType: "Additional Listing", kind: "other" },
  CS: { filingType: "Circular/Notice", kind: "other" },
  GM: { filingType: "General Meeting", kind: "other" },
  MECO: { filingType: "General Meeting", kind: "other" },
  SA: { filingType: "Special Announcement", kind: "other" },
  SB: { filingType: "Share Buy-Back", kind: "other" },
};

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function companyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(berhad|bhd|sdn|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const byCompanyKey = (() => {
  const map = new Map<string, UniverseEntry>();
  for (const entry of universe) {
    for (const label of [entry.fullName, entry.name, entry.shortName, ...entry.aliases]) {
      const key = companyKey(label);
      if (key.length >= 3 && !map.has(key)) map.set(key, entry);
    }
  }
  return map;
})();

function resolveIssuer(label: string | null): UniverseEntry | null {
  if (!label) return null;
  return byCompanyKey.get(companyKey(label)) ?? null;
}

function parseClock(label: string): { hours: number; minutes: number } | null {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const pm = match[3].toLowerCase() === "pm";
  if (pm && hours < 12) hours += 12;
  if (!pm && hours < 12 && match[3].toLowerCase() === "am" && hours === 12) hours = 0;
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

function parseStamp(day: string, month: string, clockLabel: string): string | null {
  const monthIndex = MONTHS[month.toLowerCase().slice(0, 3)];
  if (monthIndex == null) return null;
  const year = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" });
  const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  return toIso(date, parseClock(clockLabel));
}

function field(html: string, className: string): string {
  const match = html.match(new RegExp(`class="${className}[^"]*"[^>]*>([\\s\\S]*?)</`, "i"));
  return match ? decode(match[1]) : "";
}

function classify(tagCode: string, tagLabel: string, title: string): { filingType: string; kind: AnnouncementKind } {
  const mapped = TAG_KIND[tagCode.toUpperCase()];
  const haystack = `${tagLabel} ${title}`.toLowerCase();

  if (/\b(dividend|entitlement|dps|interim single)\b/.test(haystack)) {
    return { filingType: tagLabel || "Dividend Entitlement", kind: "dividend" };
  }
  if (/\b(quarterly|financial result|annual audited|annual report)\b/.test(haystack)) {
    return { filingType: tagLabel || mapped?.filingType || "Quarterly Report", kind: "financial" };
  }
  if (
    /\b(director|board of directors|section 219|appointment of|cessation of|dealings in listed)\b/.test(
      haystack,
    )
  ) {
    return { filingType: tagLabel || mapped?.filingType || "Director Changes", kind: "director" };
  }

  if (mapped) {
    return { filingType: tagLabel || mapped.filingType, kind: mapped.kind };
  }

  return { filingType: tagLabel || "General Announcement", kind: "other" };
}

function bursaUrl(id: string): string {
  return `${BURSA_DETAILS}${id}`;
}

function viewUrl(id: string): string {
  return `${VIEW_BASE}/${id}`;
}

function absoluteFile(href: string): string {
  const path = href.replace(/&amp;/g, "&");
  return path.startsWith("http") ? path : `${FILE_HOST}${path}`;
}

function parseListing(html: string): MarketAnnouncement[] {
  const items: MarketAnnouncement[] = [];
  const seen = new Set<string>();
  const marker = 'class="announcement-item"';
  let from = 0;

  while (from < html.length && items.length < MAX_ITEMS) {
    const idx = html.indexOf(marker, from);
    if (idx < 0) break;
    from = idx + marker.length;

    const tagStart = html.lastIndexOf("<a", idx);
    if (tagStart < 0) continue;
    const href = html
      .slice(tagStart, idx)
      .match(/href="([^"]*\/v2\/announcements\/view\/(\d+))"/i);
    if (!href) continue;
    const id = href[2];
    if (seen.has(id)) continue;
    seen.add(id);

    const end = html.indexOf("</a>", idx);
    const body = end > idx ? html.slice(idx, end) : html.slice(idx, idx + 2_500);
    const title = field(body, "title");
    if (title.length < 8) continue;

    const company = field(body, "company-label") || null;
    const tagLabel = field(body, "category-tag");
    const tagCode = body.match(/category-tag\s+cat-([A-Z]+)/i)?.[1] ?? "";
    const issuer = resolveIssuer(company);
    const { filingType, kind } = classify(tagCode, tagLabel, title);

    items.push({
      id,
      title,
      company: company ?? issuer?.fullName ?? null,
      companyName: company ?? issuer?.fullName ?? null,
      code: issuer?.code ?? null,
      symbol: issuer?.symbol ?? null,
      shariah: issuer?.shariah ?? null,
      filingType,
      kind,
      publishedAt: parseStamp(field(body, "day"), field(body, "month"), field(body, "time-ago")),
      url: viewUrl(id),
      bursaUrl: bursaUrl(id),
      pdfUrl: null,
      pdfName: null,
      source: "Bursa Malaysia",
    });
  }

  return items;
}

function extractPdf(html: string): { pdfUrl: string; pdfName: string } | null {
  const named = html.match(
    /href=(["'])((?:https?:\/\/disclosure\.bursamalaysia\.com)?\/FileAccess\/apbursaweb\/download\?[^"']+)\1[^>]*>\s*([\s\S]*?\.pdf)\s*</i,
  );
  if (named) {
    return {
      pdfUrl: absoluteFile(named[2]),
      pdfName: decode(named[3]).replace(/\s+/g, " ").trim(),
    };
  }

  const any = html.match(
    /href=(["'])((?:https?:\/\/disclosure\.bursamalaysia\.com)?\/FileAccess\/apbursaweb\/download\?[^"']+)\1/i,
  );
  if (!any) return null;
  return { pdfUrl: absoluteFile(any[2]), pdfName: "Filing" };
}

function extractExcerpt(html: string): string | null {
  const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1];
  if (pre) {
    const text = decode(pre);
    if (text.length > 40) return text.slice(0, 600);
  }
  const snippet = html.match(/class="formContentData2"[^>]*>([\s\S]*?)<\/td>/i)?.[1];
  return snippet ? decode(snippet).slice(0, 400) || null : null;
}

export function isAnnouncementId(value: string): boolean {
  return /^\d{6,12}$/.test(value);
}

/** Reject a detail payload that resolved to a different issuer than the charted ticker. */
export function filingMatchesSymbol(
  detail: Pick<MarketAnnouncement, "symbol" | "code">,
  entry: UniverseEntry,
): boolean {
  if (detail.symbol && detail.symbol !== entry.symbol) return false;
  if (detail.code && detail.code !== entry.code) return false;
  return true;
}

export async function getAnnouncementsFeed(): Promise<AnnouncementsPayload> {
  const html = await fetchHtml(LIST_URL, 20_000, { Referer: "https://www.klsescreener.com/v2/" });
  const items = parseListing(html);
  if (items.length === 0) {
    throw new Error("Bursa announcement listing returned no filings");
  }
  return {
    source: "bursa",
    asOf: new Date().toISOString(),
    items,
    errors: [],
  };
}

export async function getAnnouncementDetail(id: string): Promise<AnnouncementDetailPayload> {
  if (!isAnnouncementId(id)) {
    throw new Error("Invalid announcement id");
  }

  const html = await fetchHtml(viewUrl(id), 20_000, { Referer: LIST_URL });
  const pdf = extractPdf(html);
  const company =
    html.match(/class="company_name"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ??
    html.match(/Company Name[\s\S]*?formContentDataH[^>]*>([\s\S]*?)<\/td>/i)?.[1];
  const stockName = html.match(/Stock Name[\s\S]*?formContentDataH[^>]*>([\s\S]*?)<\/td>/i)?.[1];
  const category = html.match(/Category[\s\S]*?formContentDataH[^>]*>([\s\S]*?)<\/td>/i)?.[1];
  const title =
    html.match(/<h3>\s*([\s\S]*?)\s*<\/h3>/i)?.[1] ??
    html.match(/property="og:title" content="([^"]+)"/i)?.[1] ??
    "Announcement";

  const decodedCompany = company ? decode(company) : null;
  const decodedStock = stockName ? decode(stockName) : null;
  const issuer = resolveIssuer(decodedCompany) ?? resolveIssuer(decodedStock);
  const decodedTitle = decode(title).replace(/\s+\|\s+KLSE Screener$/i, "");
  const decodedCategory = category ? decode(category) : "";
  const { filingType, kind } = classify("", decodedCategory, decodedTitle);

  return {
    id,
    title: decodedTitle,
    company: decodedCompany ?? issuer?.fullName ?? null,
    companyName: decodedCompany ?? issuer?.fullName ?? null,
    code: issuer?.code ?? null,
    symbol: issuer?.symbol ?? null,
    shariah: issuer?.shariah ?? null,
    filingType,
    kind,
    publishedAt: null,
    url: viewUrl(id),
    bursaUrl: bursaUrl(id),
    pdfUrl: pdf?.pdfUrl ?? null,
    pdfName: pdf?.pdfName ?? null,
    source: "Bursa Malaysia",
    excerpt: extractExcerpt(html),
  };
}

export const ANNOUNCEMENTS_TTL_MS = LIST_TTL_MS;
