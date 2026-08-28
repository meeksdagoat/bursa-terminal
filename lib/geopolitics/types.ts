import type { Headline, HeadlinesPayload } from "@/lib/types";

export type GeopoliticalEventType = "conflict" | "disaster" | "election" | "general";

export type GeopoliticalRiskLevel = "quiet" | "elevated" | "high" | "crisis";

export type GeopoliticalCountryDef = {
  iso2: string;
  iso3: string;
  name: string;
  aliases: string[];
  coordinates: [number, number];
};

export type CountryGeopoliticsMetrics = {
  iso2: string;
  name: string;
  articleCount: number;
  conflictHits: number;
  disasterHits: number;
  electionHits: number;
  riskLevel: GeopoliticalRiskLevel;
  eventType: GeopoliticalEventType;
  sentimentScore: number;
  articles: Headline[];
  coordinates: [number, number];
};

export type GeopoliticsHotspot = {
  iso2: string;
  name: string;
  coordinates: [number, number];
  eventType: GeopoliticalEventType;
  priority: "normal" | "high";
  articleCount: number;
};

export type GeopoliticsMapModel = {
  byIso2: Record<string, CountryGeopoliticsMetrics>;
  hotspots: GeopoliticsHotspot[];
  totalMatched: number;
  unmatchedCount: number;
};

export type GlobalPoliticsNewsPayload = HeadlinesPayload & {
  byIso2: Record<string, Headline[]>;
  matchedCountries: number;
};
