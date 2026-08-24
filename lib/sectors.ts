import type { SectorPerformance } from "./types";
import { universe } from "./universe";

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
  { label: "Technology", sectors: ["Tech"] },
  { label: "Financial Services", sectors: ["Banking", "Financials"] },
  { label: "Construction", sectors: ["Construction"] },
  { label: "Plantation", sectors: ["Plantation"] },
  { label: "Utilities", sectors: ["Utilities"] },
  { label: "Energy", sectors: ["Energy"] },
] as const;

const PER_SECTOR_CAP = 6;

/** Representative names for the economy heatmap; keeps the quotes request bounded. */
export function heatmapSymbols(): string[] {
  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const group of HEATMAP_GROUPS) {
    let taken = 0;
    for (const entry of universe) {
      if (!group.sectors.includes(entry.sector as never)) continue;
      if (seen.has(entry.symbol)) continue;
      seen.add(entry.symbol);
      symbols.push(entry.symbol);
      taken += 1;
      if (taken >= PER_SECTOR_CAP) break;
    }
  }

  return symbols;
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
      changePct:
        weighted.length > 0
          ? weighted.reduce((sum, value) => sum + value, 0) / weighted.length
          : null,
      count,
    };
  });
}
