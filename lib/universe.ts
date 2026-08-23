import type { UniverseEntry } from "./types";

export const KLCI_SYMBOL = "^KLSE";

/**
 * Shariah flags are curated from the Securities Commission list of Shariah-compliant
 * securities; Yahoo Finance does not publish that classification.
 */
export const SHARIAH_SOURCE = "Curated from the SC Shariah-compliant securities list";

export const universe: UniverseEntry[] = [
  { symbol: "1155.KL", code: "1155", name: "Maybank", sector: "Banking", shariah: false },
  { symbol: "1295.KL", code: "1295", name: "Public Bank", sector: "Banking", shariah: false },
  { symbol: "1023.KL", code: "1023", name: "CIMB Group", sector: "Banking", shariah: false },
  { symbol: "5347.KL", code: "5347", name: "Tenaga", sector: "Energy", shariah: true },
  { symbol: "3182.KL", code: "3182", name: "Genting", sector: "Gaming", shariah: false },
  { symbol: "0166.KL", code: "0166", name: "Inari", sector: "Tech", shariah: true },
  { symbol: "5183.KL", code: "5183", name: "Petronas Chem", sector: "Chemicals", shariah: true },
  { symbol: "6012.KL", code: "6012", name: "Maxis", sector: "Telco", shariah: true },
];

export const universeSymbols = universe.map((entry) => entry.symbol);

export function findEntry(query: string): UniverseEntry | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  const withoutSuffix = q.replace(/\.kl$/, "");
  return (
    universe.find(
      (entry) =>
        entry.symbol.toLowerCase() === q ||
        entry.code === withoutSuffix ||
        entry.name.toLowerCase() === q,
    ) ??
    universe.find(
      (entry) =>
        entry.code.startsWith(withoutSuffix) || entry.name.toLowerCase().startsWith(q),
    )
  );
}

export function entryBySymbol(symbol: string): UniverseEntry | undefined {
  return universe.find((entry) => entry.symbol === symbol);
}
