import "server-only";

import { fetchRss, googleNewsUrl, headlineKey, stripPublisherSuffix } from "./rss";
import type { OfficialDesk, OfficialPayload, OfficialPost } from "./types";

const PER_FEED = 12;
const PER_DESK = 8;

const DESKS: Array<{ handle: string; org: string; blurb: string; query: string }> = [
  {
    handle: "@anwaribrahim",
    org: "Prime Minister",
    blurb: "PMO statements and Anwar Ibrahim remarks",
    query: `"Anwar Ibrahim" (PMO OR "Prime Minister" OR Putrajaya) (says OR announces OR statement)`,
  },
  {
    handle: "@MoFMalaysia",
    org: "Ministry of Finance",
    blurb: "Fiscal, budget and subsidy statements",
    query: `"Ministry of Finance" Malaysia (budget OR fiscal OR subsidy OR revenue OR MOF)`,
  },
  {
    handle: "@BNM_official",
    org: "Bank Negara Malaysia",
    blurb: "Monetary policy and ringgit statements",
    query: `"Bank Negara Malaysia" (OPR OR ringgit OR "monetary policy" OR reserves OR statement)`,
  },
];

export async function getOfficialWire(): Promise<OfficialPayload> {
  const errors: string[] = [];

  const desks: OfficialDesk[] = await Promise.all(
    DESKS.map(async (desk) => {
      try {
        const entries = await fetchRss(googleNewsUrl(desk.query, { withinDays: 14 }), PER_FEED);
        const items: OfficialPost[] = [];
        const seen = new Set<string>();

        for (const entry of entries) {
          const title = stripPublisherSuffix(entry.title, entry.publisher);
          const key = headlineKey(title);
          if (key.length === 0 || seen.has(key)) continue;
          seen.add(key);
          items.push({
            id: entry.guid ?? entry.link ?? `${desk.handle}:${key}`,
            handle: desk.handle,
            title,
            url: entry.link,
            publishedAt: entry.publishedAt,
            publisher: entry.publisher,
          });
          if (items.length >= PER_DESK) break;
        }

        return { handle: desk.handle, org: desk.org, blurb: desk.blurb, items };
      } catch (error) {
        errors.push(`${desk.handle}: ${error instanceof Error ? error.message : String(error)}`);
        return { handle: desk.handle, org: desk.org, blurb: desk.blurb, items: [] };
      }
    }),
  );

  if (desks.every((desk) => desk.items.length === 0) && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return {
    asOf: new Date().toISOString(),
    desks,
    errors,
  };
}
