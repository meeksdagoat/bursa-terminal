import type { Headline } from "@/lib/types";
import { GEOPOLITICAL_COUNTRIES, countryByIso2 } from "./countries";
import { WORLD_COUNTRIES } from "./world-registry";
import type {
  CountryGeopoliticsMetrics,
  GeopoliticalEventType,
  GeopoliticalRiskLevel,
  GeopoliticsHotspot,
  GeopoliticsMapModel,
} from "./types";

const CONFLICT_PATTERN =
  /\b(war|wars|conflict|invasion|invaded|missile|airstrike|offensive|ceasefire|military|troops|combat|shelling|drone strike|armed clash|hostage|terror|strike on|bombing|artillery)\b/i;
const DISASTER_PATTERN =
  /\b(earthquake|flood|flooding|hurricane|typhoon|wildfire|tsunami|cyclone|disaster|evacuation|landslide|drought|heatwave|storm damage)\b/i;
const ELECTION_PATTERN =
  /\b(election|elections|vote|ballot|referendum|runoff|parliament|sanction|sanctions|tariff|embargo|summit|treaty|g7|g20|nato|security council|diplomatic|briefing|gavel)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALIAS_MATCHERS = (() => {
  const seen = new Set<string>();
  const matchers: Array<{ iso2: string; pattern: RegExp }> = [];

  function add(iso2: string, alias: string) {
    const key = `${iso2}:${alias.toLowerCase()}`;
    if (seen.has(key) || alias.trim().length < 3) return;
    seen.add(key);
    matchers.push({ iso2, pattern: new RegExp(`\\b${escapeRegex(alias)}\\b`, "i") });
  }

  for (const country of WORLD_COUNTRIES) {
    add(country.iso2, country.name);
  }

  for (const country of GEOPOLITICAL_COUNTRIES) {
    for (const alias of country.aliases) add(country.iso2, alias);
  }

  return matchers.sort((left, right) => right.pattern.source.length - left.pattern.source.length);
})();

function scoreHeadline(text: string): {
  conflict: number;
  disaster: number;
  election: number;
} {
  const conflict = (text.match(CONFLICT_PATTERN) ?? []).length;
  const disaster = (text.match(DISASTER_PATTERN) ?? []).length;
  const election = (text.match(ELECTION_PATTERN) ?? []).length;
  return { conflict, disaster, election };
}

function dominantEventType(
  conflict: number,
  disaster: number,
  election: number,
): GeopoliticalEventType {
  if (conflict >= disaster && conflict >= election && conflict > 0) return "conflict";
  if (disaster >= election && disaster > 0) return "disaster";
  if (election > 0) return "election";
  return "general";
}

function riskLevel(
  articleCount: number,
  conflictHits: number,
  disasterHits: number,
): GeopoliticalRiskLevel {
  if (articleCount === 0) return "quiet";
  if (conflictHits >= 2 || (conflictHits >= 1 && articleCount >= 4)) return "crisis";
  if (conflictHits >= 1 || disasterHits >= 2 || articleCount >= 6) return "high";
  if (articleCount >= 2 || disasterHits >= 1) return "elevated";
  return "quiet";
}

function sentimentScore(conflictHits: number, disasterHits: number, electionHits: number): number {
  const negative = conflictHits * 18 + disasterHits * 10;
  const positive = electionHits * 6;
  return Math.max(-100, Math.min(100, positive - negative));
}

export function matchHeadlineCountries(text: string): string[] {
  const matched = new Set<string>();
  for (const matcher of ALIAS_MATCHERS) {
    if (matcher.pattern.test(text)) matched.add(matcher.iso2);
  }
  return [...matched];
}

function emptyMetrics(iso2: string, name: string): CountryGeopoliticsMetrics {
  const def = countryByIso2(iso2);
  return {
    iso2,
    name,
    articleCount: 0,
    conflictHits: 0,
    disasterHits: 0,
    electionHits: 0,
    riskLevel: "quiet",
    eventType: "general",
    sentimentScore: 0,
    articles: [],
    coordinates: def?.coordinates ?? [0, 0],
  };
}

export function countryMetricsForIso2(
  model: GeopoliticsMapModel,
  iso2: string,
  fallbackName?: string,
): CountryGeopoliticsMetrics {
  const existing = model.byIso2[iso2];
  if (existing) return existing;
  const name = fallbackName ?? countryByIso2(iso2)?.name ?? iso2;
  return emptyMetrics(iso2, name);
}

export function analyzeGeopoliticsHeadlines(items: Headline[]): GeopoliticsMapModel {
  const buckets = new Map<string, CountryGeopoliticsMetrics>();

  for (const country of WORLD_COUNTRIES) {
    buckets.set(country.iso2, emptyMetrics(country.iso2, country.name));
  }

  let totalMatched = 0;

  for (const item of items) {
    const text = `${item.title} ${item.snippet ?? ""}`;
    const countries = matchHeadlineCountries(text);
    if (countries.length === 0) continue;

    const scores = scoreHeadline(text);
    totalMatched += 1;

    for (const iso2 of countries) {
      const bucket = buckets.get(iso2) ?? emptyMetrics(iso2, iso2);
      bucket.articleCount += 1;
      bucket.conflictHits += scores.conflict;
      bucket.disasterHits += scores.disaster;
      bucket.electionHits += scores.election;
      bucket.articles.push(item);
      buckets.set(iso2, bucket);
    }
  }

  const byIso2: Record<string, CountryGeopoliticsMetrics> = {};
  const hotspots: GeopoliticsHotspot[] = [];

  for (const bucket of buckets.values()) {
    bucket.articles.sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));

    bucket.riskLevel = riskLevel(bucket.articleCount, bucket.conflictHits, bucket.disasterHits);
    bucket.eventType = dominantEventType(bucket.conflictHits, bucket.disasterHits, bucket.electionHits);
    bucket.sentimentScore = sentimentScore(bucket.conflictHits, bucket.disasterHits, bucket.electionHits);

    byIso2[bucket.iso2] = bucket;

    if (bucket.articleCount >= 2 && bucket.eventType !== "general") {
      const def = countryByIso2(bucket.iso2);
      hotspots.push({
        iso2: bucket.iso2,
        name: bucket.name,
        coordinates: def?.coordinates ?? bucket.coordinates,
        eventType: bucket.eventType,
        priority: bucket.riskLevel === "crisis" || bucket.riskLevel === "high" ? "high" : "normal",
        articleCount: bucket.articleCount,
      });
    }
  }

  hotspots.sort((left, right) => right.articleCount - left.articleCount);

  return {
    byIso2,
    hotspots,
    totalMatched,
    unmatchedCount: Math.max(0, items.length - totalMatched),
  };
}

export function riskLevelLabel(level: GeopoliticalRiskLevel): string {
  switch (level) {
    case "crisis":
      return "Crisis Zone";
    case "high":
      return "High Activity";
    case "elevated":
      return "Elevated Activity";
    default:
      return "Quiet";
  }
}

export function activityStatusLabel(metrics: CountryGeopoliticsMetrics | undefined): string {
  const count = metrics?.articleCount ?? 0;
  if (count === 0) return "Activity: Quiet (0 active stories)";
  return `Activity: ${count} active ${count === 1 ? "story" : "stories"}`;
}

export function countryFillColor(metrics: CountryGeopoliticsMetrics | undefined): string {
  if (!metrics || metrics.articleCount === 0) return "#1a1a1a";

  switch (metrics.riskLevel) {
    case "crisis":
      return "#ef4444";
    case "high":
      return "#ea580c";
    case "elevated":
      return "#d97706";
    default:
      return metrics.articleCount >= 2 ? "#78350f" : "#292524";
  }
}

export function countryStrokeColor(
  iso2: string,
  selectedIso2: string | null,
  hoveredIso2: string | null,
): string {
  if (selectedIso2 === iso2) return "#eab308";
  if (hoveredIso2 === iso2) return "#3b82f6";
  return "#262626";
}
