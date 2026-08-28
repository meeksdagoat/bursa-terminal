import { entryBySymbol } from "@/lib/universe";

/** Curated display names for Quant Hub and terminal panels. */
const EXPLICIT_STOCK_NAMES: Record<string, string> = {
  "1155": "Maybank",
  "1295": "Public Bank",
  "1023": "CIMB Group",
  "2445": "KL Kepong",
  "1961": "IOI Corp",
  "5285": "Sime Darby Plantation",
  "5183": "Petronas Chemicals",
  "^KLSE": "FBM KLCI",
};

function normalizeLookupKey(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) return "";
  if (trimmed.startsWith("^")) return trimmed;
  return trimmed.replace(/\.KL$/i, "");
}

function toUniverseSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) return "";
  if (trimmed.startsWith("^")) return trimmed;
  if (/\.KL$/i.test(trimmed)) return trimmed;
  return `${trimmed}.KL`;
}

/** Bursa code without the `.KL` suffix, or index root (e.g. `KLSE`). */
export function getStockCode(symbol: string): string {
  const key = normalizeLookupKey(symbol);
  if (!key) return "";
  return key.startsWith("^") ? key.slice(1) : key;
}

/**
 * Human-readable short name for a ticker. Uses curated overrides first, then the
 * tracked universe roster, then a cleaned fallback so UI labels never go blank.
 */
export function getStockName(symbol: string): string {
  const key = normalizeLookupKey(symbol);
  if (!key) return "Unknown";

  const explicit = EXPLICIT_STOCK_NAMES[key];
  if (explicit) return explicit;

  const entry = entryBySymbol(toUniverseSymbol(symbol));
  if (entry?.name) return entry.name;
  if (entry?.shortName) return entry.shortName;

  if (key.startsWith("^")) return key.slice(1);
  return key;
}

/** Dropdown label, e.g. `Maybank (1155)`. */
export function formatStockOptionLabel(symbol: string): string {
  const name = getStockName(symbol);
  const code = getStockCode(symbol);
  if (!code) return name;
  if (code === "KLSE") return name;
  return `${name} (${code})`;
}

/** Comma-separated short names for factor cards and methodology panels. */
export function formatStockList(symbols: readonly string[], limit?: number): string {
  const slice = limit != null ? symbols.slice(0, limit) : symbols;
  const names = slice.map((symbol) => getStockName(symbol)).filter((name) => name.length > 0);
  return names.length > 0 ? names.join(", ") : "—";
}

/** Chart legend / tooltip label, e.g. `Maybank Price`. */
export function formatStockPriceLabel(symbol: string): string {
  const name = getStockName(symbol);
  return name === "Unknown" ? "Price" : `${name} Price`;
}

/** Dot-separated compact list for score-card footers. */
export function formatStockListInline(symbols: readonly string[], limit?: number): string {
  const slice = limit != null ? symbols.slice(0, limit) : symbols;
  const names = slice.map((symbol) => getStockName(symbol)).filter((name) => name.length > 0);
  return names.length > 0 ? names.join(" · ") : "—";
}
