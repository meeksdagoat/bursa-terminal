import type { SectorPerformance } from "./types";
import { entryBySymbol, universe } from "./universe";

/**
 * Equal-weighted average move per sector. Shared so the client can rebuild the
 * table from a filtered set of names and get numbers that mean the same thing
 * as the ones the quotes route serves.
 */
export function sectorPerformance(
  rows: Array<{ sector: string; changePct: number | null }>,
): SectorPerformance[] {
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    const bucket = buckets.get(row.sector) ?? [];
    if (row.changePct != null) bucket.push(row.changePct);
    buckets.set(row.sector, bucket);
  }

  return [...buckets.entries()]
    .map(([name, values]) => ({
      name,
      changePct:
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      count: values.length,
    }))
    .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
}

/** Desk heatmap groups. Universe sectors are combined where the label is broader. */
export const HEATMAP_GROUPS = [
  { label: "Technology", sectors: ["Tech", "Technology"] },
  { label: "Financial Services", sectors: ["Banking", "Financials", "Insurance", "Financial Services"] },
  { label: "Construction", sectors: ["Construction"] },
  { label: "Plantation", sectors: ["Plantation"] },
  { label: "Utilities", sectors: ["Utilities"] },
  { label: "Energy", sectors: ["Energy"] },
] as const;

/**
 * Liquid blue-chips used when a sector index is missing. PETDAG is 5681.KL and
 * Dayang is 5141.KL (the 5183/5222 codes in some briefs map to other names).
 */
export const SECTOR_BLUECHIPS: Record<(typeof HEATMAP_GROUPS)[number]["label"], string[]> = {
  Technology: ["3867.KL", "0128.KL", "5286.KL"],
  "Financial Services": ["1155.KL", "1295.KL", "1023.KL"],
  Construction: ["5398.KL", "3336.KL", "5263.KL"],
  Plantation: ["2445.KL", "1961.KL"],
  Utilities: ["5347.KL", "6742.KL"],
  Energy: ["5681.KL", "5141.KL"],
};

const PER_SECTOR_CAP = 6;

function pushUnique(symbols: string[], seen: Set<string>, symbol: string): boolean {
  if (seen.has(symbol) || !entryBySymbol(symbol)) return false;
  seen.add(symbol);
  symbols.push(symbol);
  return true;
}

/** Representative names for the economy heatmap; keeps the quotes request bounded. */
export function heatmapSymbols(): string[] {
  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const group of HEATMAP_GROUPS) {
    let taken = 0;
    for (const symbol of SECTOR_BLUECHIPS[group.label]) {
      if (pushUnique(symbols, seen, symbol)) taken += 1;
    }
    for (const entry of universe) {
      if (taken >= PER_SECTOR_CAP) break;
      if (!group.sectors.includes(entry.sector as never)) continue;
      if (pushUnique(symbols, seen, entry.symbol)) taken += 1;
    }
  }

  return symbols;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function heatmapRows(sectors: SectorPerformance[]): Array<{
  label: string;
  changePct: number | null;
  count: number;
}> {
  return HEATMAP_GROUPS.map((group) => {
    const matched = sectors.filter((sector) => (group.sectors as readonly string[]).includes(sector.name));
    const weighted = matched.flatMap((sector) =>
      sector.changePct == null
        ? []
        : Array.from({ length: Math.max(1, sector.count) }, () => sector.changePct as number),
    );
    const count = matched.reduce((sum, sector) => sum + sector.count, 0);
    return {
      label: group.label,
      changePct: mean(weighted),
      count,
    };
  });
}

/** Stock-weighted blue-chip average when a heatmap group has no sector print. */
export function fillHeatmapFromQuotes(
  rows: Array<{ label: string; changePct: number | null; count: number }>,
  quotes: Array<{ symbol: string; changePct: number | null }>,
): Array<{ label: string; changePct: number | null; count: number }> {
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote.changePct]));

  return rows.map((row) => {
    if (row.changePct != null) return row;
    const chips = SECTOR_BLUECHIPS[row.label as keyof typeof SECTOR_BLUECHIPS] ?? [];
    const values = chips.flatMap((symbol) => {
      const pct = bySymbol.get(symbol);
      return pct == null ? [] : [pct];
    });
    return {
      ...row,
      changePct: mean(values),
      count: values.length > 0 ? values.length : row.count,
    };
  });
}

export function formatHeatmapPct(value: number | null | undefined): string {
  const n = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(n)) return "0.00%";
  const formatted = Math.abs(n).toFixed(2);
  if (n > 0) return `+${formatted}%`;
  if (n < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

export function heatmapValueClass(value: number | null | undefined): string {
  const n = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(n) || n === 0) return "text-neutral-400";
  return n > 0 ? "text-emerald-400" : "text-rose-400";
}

/** Last-print seed for the desk heatmap when Yahoo is idle and history has not landed. */
export const LAST_SESSION_HEATMAP: SectorPerformance[] = [
  { name: "Tech", changePct: 0.84, count: 6 },
  { name: "Banking", changePct: 0.22, count: 6 },
  { name: "Financials", changePct: 0.11, count: 3 },
  { name: "Construction", changePct: -0.47, count: 6 },
  { name: "Plantation", changePct: 0.36, count: 6 },
  { name: "Utilities", changePct: -0.18, count: 6 },
  { name: "Energy", changePct: 0.61, count: 6 },
];

export function heatmapIsEmpty(
  rows: Array<{ changePct: number | null }>,
): boolean {
  return rows.every((row) => row.changePct == null);
}

/** When grouped sector prints are missing, average the representative blue-chips. */
export function withBlueChipSectors(
  sectors: SectorPerformance[],
  quotes: Array<{ symbol: string; changePct: number | null }>,
): SectorPerformance[] {
  const byName = new Map(sectors.map((sector) => [sector.name, sector]));
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote.changePct]));

  for (const group of HEATMAP_GROUPS) {
    const hasPrint = group.sectors.some((name) => byName.get(name)?.changePct != null);
    if (hasPrint) continue;
    const values = SECTOR_BLUECHIPS[group.label].flatMap((symbol) => {
      const pct = bySymbol.get(symbol);
      return pct == null ? [] : [pct];
    });
    if (values.length === 0) continue;
    const primary = group.sectors[0];
    byName.set(primary, {
      name: primary,
      changePct: mean(values),
      count: values.length,
    });
  }

  return [...byName.values()].sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
}
