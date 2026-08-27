import "server-only";

import { getBursaAnnouncements } from "./bursa-announcements";
import { announcementIdFromUrl, bursaAnnouncementUrl, isFutureOrPlaceholderFiling, klseViewUrl } from "./filing-id";
import type {
  AnnouncementCategory,
  AnnouncementKind,
  CompanyFilingsPayload,
  MarketAnnouncement,
  UniverseEntry,
} from "./types";

function kindFromCategory(category: AnnouncementCategory): AnnouncementKind {
  if (category === "Financial Result") return "financial";
  if (category === "Dividend") return "dividend";
  if (category === "Board Change") return "director";
  return "other";
}

function filingTypeFromCategory(category: AnnouncementCategory): string {
  switch (category) {
    case "Financial Result":
      return "Quarterly Report";
    case "Dividend":
      return "Dividend Entitlement";
    case "Board Change":
      return "Director Changes";
    case "Shareholding Change":
      return "Shareholding Change";
    case "Additional Listing":
      return "Additional Listing";
    case "General Announcement":
      return "General Announcement";
    default:
      return "General Announcement";
  }
}

export function toCompanyFilings(
  payload: Awaited<ReturnType<typeof getBursaAnnouncements>>,
  entry: UniverseEntry,
): CompanyFilingsPayload {
  const items: MarketAnnouncement[] = [];

  for (const item of payload.items) {
    if (isFutureOrPlaceholderFiling(item.title, item.publishedAt)) continue;
    const id = announcementIdFromUrl(item.url ?? item.id);
    if (!id) continue;
    items.push({
      id,
      title: item.title,
      company: entry.fullName,
      companyName: entry.fullName,
      code: entry.code,
      symbol: entry.symbol,
      shariah: entry.shariah,
      filingType: filingTypeFromCategory(item.category),
      kind: kindFromCategory(item.category),
      publishedAt: item.publishedAt,
      url: item.url ?? klseViewUrl(id),
      bursaUrl: bursaAnnouncementUrl(id),
      pdfUrl: null,
      pdfName: null,
      source: item.source,
    });
  }

  return {
    source: payload.source,
    symbol: entry.symbol,
    company: entry.fullName,
    asOf: payload.asOf,
    items,
    errors: [],
  };
}

export async function getBursaFilings(entry: UniverseEntry): Promise<CompanyFilingsPayload> {
  return toCompanyFilings(await getBursaAnnouncements(entry), entry);
}
