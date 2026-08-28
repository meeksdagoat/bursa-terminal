import { countryMetricsForIso2 } from "@/lib/geopolitics/analyze";
import type { GeopoliticsMapModel, GeopoliticalRiskLevel } from "@/lib/geopolitics/types";
import { WORLD_COUNTRIES, type WorldCountryRecord } from "@/lib/geopolitics/world-registry";

export type CountrySearchResult = {
  iso2: string;
  iso3: string;
  name: string;
  articleCount: number;
  riskLevel: GeopoliticalRiskLevel;
  conflictHits: number;
};

const DROPDOWN_LIMIT = 12;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesCountry(record: WorldCountryRecord, query: string): boolean {
  if (!query) return true;

  const iso2 = record.iso2.toLowerCase();
  const iso3 = record.iso3.toLowerCase();
  const name = record.name.toLowerCase();

  if (iso2 === query || iso3 === query) return true;
  if (iso2.startsWith(query) || iso3.startsWith(query)) return true;
  if (name.includes(query)) return true;

  return false;
}

function toSearchResult(record: WorldCountryRecord, model: GeopoliticsMapModel): CountrySearchResult {
  const metrics = countryMetricsForIso2(model, record.iso2, record.name);
  return {
    iso2: record.iso2,
    iso3: record.iso3,
    name: metrics.name,
    articleCount: metrics.articleCount,
    riskLevel: metrics.riskLevel,
    conflictHits: metrics.conflictHits,
  };
}

export function searchCountries(
  query: string,
  model: GeopoliticsMapModel,
  limit = DROPDOWN_LIMIT,
): { results: CountrySearchResult[]; totalMatches: number } {
  const normalized = normalizeQuery(query);

  const matched = WORLD_COUNTRIES.filter((record) => matchesCountry(record, normalized)).map((record) =>
    toSearchResult(record, model),
  );

  matched.sort((left, right) => {
    if (right.articleCount !== left.articleCount) return right.articleCount - left.articleCount;
    return left.name.localeCompare(right.name);
  });

  return {
    results: matched.slice(0, limit),
    totalMatches: matched.length,
  };
}

export function countryStatusDotClass(result: Pick<CountrySearchResult, "articleCount" | "conflictHits" | "riskLevel">): string {
  if (result.articleCount === 0) return "bg-neutral-600";
  if (result.conflictHits > 0 || result.riskLevel === "crisis") return "bg-red-500";
  if (result.riskLevel === "elevated" || result.riskLevel === "high") return "bg-amber-500";
  return "bg-neutral-600";
}

export function formatStoryCount(count: number): string {
  if (count === 0) return "Quiet";
  return `${count} ${count === 1 ? "story" : "stories"}`;
}
