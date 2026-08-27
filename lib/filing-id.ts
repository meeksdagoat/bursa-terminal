import type { AnnouncementCategory, AnnouncementKind, BursaAnnouncement, MarketAnnouncement } from "./types";

/** Numeric Bursa LINK / KLSE Screener announcement id, when one can be parsed. */
export function announcementIdFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{6,12}$/.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/\/announcements\/view\/(\d{6,12})/i) ??
    trimmed.match(/[?&]ann_id=(\d{6,12})/i) ??
    trimmed.match(/[?&]docId=(\d{6,12})/i);
  return match?.[1] ?? null;
}

export function bursaAnnouncementUrl(id: string): string {
  return `https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=${id}`;
}

export function bursaCompanyAnnouncementsUrl(stockCode: string): string {
  return `https://www.bursamalaysia.com/market_information/announcements/company_announcement?company=${encodeURIComponent(stockCode)}`;
}

export function isBursaAnnouncementDetailUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/announcement_details\?[^#]*ann_id=\d{6,12}/i.test(url);
}

/**
 * Prefer an explicit announcement detail link. Rebuild from `ann_id` when the
 * payload only has a company-wide announcements search URL.
 */
export function resolveBursaAnnouncementUrl(input: {
  id?: string | null;
  bursaUrl?: string | null;
  url?: string | null;
  stockCode?: string | null;
}): string {
  if (isBursaAnnouncementDetailUrl(input.bursaUrl)) {
    return input.bursaUrl as string;
  }

  const id =
    announcementIdFromUrl(input.id) ??
    announcementIdFromUrl(input.bursaUrl) ??
    announcementIdFromUrl(input.url);

  if (id) return bursaAnnouncementUrl(id);

  if (input.stockCode) return bursaCompanyAnnouncementsUrl(input.stockCode);
  if (input.url) return input.url;
  return input.bursaUrl ?? "https://www.bursamalaysia.com/market_information/announcements/company_announcement";
}

export function klseViewUrl(id: string): string {
  return `https://www.klsescreener.com/v2/announcements/view/${id}`;
}

/** Symbol-bound PDF proxy — never a static `public/docs/` path. */
export function filingPdfPath(symbol: string, docId: string, download = false): string {
  const path = `/api/filings/pdf?symbol=${encodeURIComponent(symbol)}&docId=${encodeURIComponent(docId)}`;
  return download ? `${path}&download=1` : path;
}

/** Same-origin stream of a Bursa disclosure URL so the iframe is not blocked by X-Frame-Options. */
export function filingProxyPdfPath(pdfUrl: string): string {
  return `/api/filings/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`;
}

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

function periodEndFromTitle(title: string): Date | null {
  const numeric = title.match(/period ended\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const named = title.match(
    /period ended\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})/i,
  );
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month == null) return null;
    const date = new Date(Date.UTC(Number(named[3]), month, Number(named[1])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Drop estimates, stubs, and any row whose period-end or publication date is still in the future. */
export function isFutureOrPlaceholderFiling(
  title: string,
  publishedAt: string | null,
  now = new Date(),
): boolean {
  const text = title.toLowerCase();
  if (/\b(placeholder|consensus estimate|not yet released|forthcoming)\b/.test(text)) return true;

  if (publishedAt) {
    const published = new Date(publishedAt);
    if (!Number.isNaN(published.getTime()) && published.getTime() > now.getTime()) return true;
  }

  const periodEnd = periodEndFromTitle(title);
  return periodEnd != null && periodEnd.getTime() > now.getTime();
}

function kindFromCategory(category: AnnouncementCategory): AnnouncementKind {
  if (category === "Financial Result") return "financial";
  if (category === "Dividend") return "dividend";
  if (category === "Board Change") return "director";
  return "other";
}

/** Map a per-ticker announcement row into the Official Filing viewer model. */
export function toViewerFiling(
  item: BursaAnnouncement,
  activeTicker: string,
  companyName: string,
): MarketAnnouncement | null {
  const id = announcementIdFromUrl(item.url ?? item.id);
  if (!id) return null;
  if (isFutureOrPlaceholderFiling(item.title, item.publishedAt)) return null;
  const code = activeTicker.replace(/\.KL$/i, "");
  return {
    id,
    title: item.title,
    company: companyName,
    companyName,
    code,
    symbol: activeTicker,
    shariah: null,
    filingType: item.category,
    kind: kindFromCategory(item.category),
    publishedAt: item.publishedAt,
    url: item.url ?? klseViewUrl(id),
    bursaUrl: bursaAnnouncementUrl(id),
    pdfUrl: null,
    pdfName: null,
    source: item.source,
  };
}
