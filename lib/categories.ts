/** Client-safe headline category constants; keep free of server-only imports. */

export const HEADLINE_CATEGORIES = [
  {
    id: "my-politics",
    label: "Politics",
    blurb: "Parliament, cabinet and coalition politics",
  },
  {
    id: "my-economy",
    label: "Economy",
    blurb: "Bank Negara, GDP prints and the trade balance",
  },
  {
    id: "global-economy",
    label: "Global Economy",
    blurb: "Fed, ECB, Treasuries and global risk assets",
  },
  {
    id: "my-companies",
    label: "Companies",
    blurb: "Bursa-listed corporates, earnings and deals",
  },
  {
    id: "world-politics",
    label: "Global Politics",
    blurb: "Geopolitics, elections and diplomacy worldwide",
  },
] as const;

export type HeadlineCategory = (typeof HEADLINE_CATEGORIES)[number]["id"];

/**
 * Badges each desk always offers, even before a matching story lands, so the
 * filter row does not shift as the wire updates. Tags found in the feed are
 * appended after these.
 */
export const POLITICS_DESK_TAGS = ["#Subsidy", "#JS-SEZ", "#Cabinet", "#Budget"];
export const ECONOMY_DESK_TAGS = ["#BNM", "#GDP", "#Trade"];
export const GLOBAL_ECONOMY_TAGS = ["#FOMC", "#CPI", "#Fed"];

export const DEFAULT_CATEGORY: HeadlineCategory = "my-politics";

const IDS = new Set<string>(HEADLINE_CATEGORIES.map((category) => category.id));

export function isHeadlineCategory(value: string | null | undefined): value is HeadlineCategory {
  return value != null && IDS.has(value);
}

export function categoryLabel(id: HeadlineCategory): string {
  return HEADLINE_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

export function deskHref(id: HeadlineCategory): string {
  if (id === DEFAULT_CATEGORY) return "/news";
  if (id === "global-economy") return "/global-economy";
  return `/news?desk=${id}`;
}
