import roster from "@/data/bursa-universe.json";
import type { MarketBoard, UniverseEntry } from "./types";
import {
  CURATED_SEED,
  DEFAULT_WATCHLIST,
  KLCI_SYMBOL,
  SHARIAH_SOURCE,
} from "./universe-curated";

export { DEFAULT_WATCHLIST, KLCI_SYMBOL, SHARIAH_SOURCE };

type RosterRow = {
  code: string;
  shortName: string;
  name: string;
  fullName: string;
  sector: string;
  market: MarketBoard;
  shariah: boolean;
  aliases: string[];
};

type IndexedEntry = UniverseEntry & {
  needles: string[];
};

const HEADER_RESULT_LIMIT = 16;

function toEntry(row: RosterRow): UniverseEntry {
  return {
    symbol: `${row.code}.KL`,
    code: row.code,
    name: row.name,
    shortName: row.shortName,
    fullName: row.fullName,
    sector: row.sector,
    market: row.market,
    shariah: row.shariah,
    isShariah: row.shariah,
    aliases: row.aliases,
  };
}

function uniqueLower(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const needle = value.toLowerCase().replace(/\.kl$/, "").trim();
    if (!needle || seen.has(needle)) continue;
    seen.add(needle);
    out.push(needle);
  }
  return out;
}

function indexEntry(entry: UniverseEntry): IndexedEntry {
  return {
    ...entry,
    needles: uniqueLower([
      entry.code,
      entry.shortName,
      entry.name,
      entry.fullName,
      entry.symbol,
      entry.sector,
      entry.market,
      ...entry.aliases,
    ]),
  };
}

const curatedCodes = new Set(CURATED_SEED.map(([code]) => code));

export const universe: UniverseEntry[] = (roster as RosterRow[]).map(toEntry);

export const universeSymbols = universe.map((entry) => entry.symbol);

/** Curated liquid names used for movers scans — not the full 1,100+ roster. */
export const liquidUniverse = universe.filter((entry) => curatedCodes.has(entry.code));

export const liquidSymbols = liquidUniverse.map((entry) => entry.symbol);

const bySymbol = new Map(universe.map((entry) => [entry.symbol, entry]));
const byCode = new Map(universe.map((entry) => [entry.code.toLowerCase(), entry]));
const byShortName = new Map(
  universe.map((entry) => [entry.shortName.toLowerCase(), entry] as const),
);
const indexed = universe.map(indexEntry);

export function entryBySymbol(symbol: string): UniverseEntry | undefined {
  return bySymbol.get(symbol) ?? byCode.get(symbol.toLowerCase().replace(/\.kl$/, ""));
}

export function isTrackedSymbol(symbol: string): boolean {
  return entryBySymbol(symbol) != null;
}

/** Same-sector names first, then other tracked tickers, so thin sectors still fill a matrix. */
export function sectorPeers(symbol: string, limit = 4): string[] {
  const entry = entryBySymbol(symbol);
  if (!entry) return [];
  const same = universe.filter((row) => row.sector === entry.sector && row.symbol !== symbol);
  const rest = universe.filter((row) => row.sector !== entry.sector && row.symbol !== symbol);
  return [...same, ...rest].slice(0, limit).map((row) => row.symbol);
}

/** High-density chart workspace. Optional ticker is applied as `?symbol=`. */
export function terminalHref(symbol?: string): string {
  return symbol ? `/terminal?symbol=${encodeURIComponent(symbol)}` : "/terminal";
}

function rankMatch(needles: string[], query: string): number {
  if (needles.some((field) => field === query)) return 0;
  if (needles[0] === query || needles[0].startsWith(query)) return 1;
  if (needles.some((field) => field.startsWith(query))) return 2;
  if (needles.some((field) => field.includes(query))) return 3;
  return -1;
}

/**
 * Ranked lookup across ticker code, short name, registered name, aliases and
 * sector. An empty query returns the head of the universe so the picker opens
 * with content. Header autocomplete should pass a small `limit` (16).
 */
export function searchUniverse(query: string, limit = HEADER_RESULT_LIMIT): UniverseEntry[] {
  const needle = query.trim().toLowerCase().replace(/\.kl$/, "");
  if (!needle) return universe.slice(0, limit);

  const exact = byCode.get(needle) ?? byShortName.get(needle) ?? bySymbol.get(`${needle}.KL`);

  const matches: Array<{ entry: UniverseEntry; score: number }> = [];
  if (exact) matches.push({ entry: exact, score: -1 });

  for (const entry of indexed) {
    if (exact && entry.symbol === exact.symbol) continue;
    const score = rankMatch(entry.needles, needle);
    if (score >= 0) matches.push({ entry, score });
  }

  return matches
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function findEntry(
  query: string,
  { shariahOnly = false }: { shariahOnly?: boolean } = {},
): UniverseEntry | undefined {
  const matches = searchUniverse(query, 12);
  return (shariahOnly ? matches.filter((entry) => entry.shariah) : matches)[0];
}

/** Padded so `includes` only matches on whole words: "Insas" never hits "Insasco". */
function padded(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const paddedNames = universe.flatMap((entry) => {
  const labels = [entry.name, entry.shortName, entry.fullName].filter((label) => label.replace(/[^a-zA-Z]/g, "").length >= 4);
  return labels.map((label) => ({ entry, needle: padded(label) }));
});

/**
 * Universe members named in free text such as a headline. Used to give the
 * plain-English explainer a subject, and to resolve a story to a Shariah
 * status when the feed itself carries no ticker.
 */
export function mentionedCompanies(text: string): UniverseEntry[] {
  const haystack = padded(text);
  const found: UniverseEntry[] = [];
  const seen = new Set<string>();

  for (const { entry, needle } of paddedNames) {
    if (seen.has(entry.symbol)) continue;
    if (haystack.includes(needle)) {
      seen.add(entry.symbol);
      found.push(entry);
    }
  }

  return found;
}
