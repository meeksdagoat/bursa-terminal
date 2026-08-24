import { formatHoldingDay, klToday } from "./portfolio";
import type { Holding } from "./portfolio";
import type { Quote } from "./types";
import { entryBySymbol } from "./universe";

export function escapeCsv(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function downloadTextFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  downloadTextFile(filename, `\uFEFF${toCsv(rows)}`, "text/csv;charset=utf-8");
}

export function stampFilename(prefix: string, ext: string): string {
  return `${prefix}-${klToday()}.${ext}`;
}

export type WatchlistExportRow = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  volume: number | null;
};

export function watchlistCsvRows(rows: WatchlistExportRow[]): Array<Array<string | number | null>> {
  return [
    ["Symbol", "Name", "Last", "Change %", "Volume"],
    ...rows.map((row) => [row.symbol, row.name, row.price, row.changePct, row.volume]),
  ];
}

export type HoldingExportRow = {
  symbol: string;
  name: string;
  quantity: number;
  costPerShare: number;
  last: number | null;
  value: number | null;
  pnl: number | null;
  boughtAt: string;
};

export function holdingsCsvRows(rows: HoldingExportRow[]): Array<Array<string | number | null>> {
  return [
    ["Symbol", "Name", "Shares", "Buy price", "Last", "Market value", "Unrealised P&L", "Bought"],
    ...rows.map((row) => [
      row.symbol,
      row.name,
      row.quantity,
      row.costPerShare,
      row.last,
      row.value,
      row.pnl,
      formatHoldingDay(row.boughtAt),
    ]),
  ];
}

export type DividendEstimate = {
  symbol: string;
  name: string;
  quantity: number;
  last: number | null;
  yieldPct: number | null;
  annual: number | null;
  nextPayout: number | null;
  nextDate: string;
};

function nextPayoutDate(from = klToday()): string {
  const year = Number(from.slice(0, 4));
  const candidates = [`${year}-03-15`, `${year}-09-15`, `${year + 1}-03-15`];
  return candidates.find((day) => day > from) ?? `${year + 1}-03-15`;
}

export function estimateDividends(
  holdings: Holding[],
  quoteBySymbol: Map<string, Quote>,
): DividendEstimate[] {
  return holdings.map((holding) => {
    const entry = entryBySymbol(holding.symbol);
    const quote = quoteBySymbol.get(holding.symbol);
    const last = quote?.price ?? null;
    const yieldPct = quote?.dividendYieldPct ?? null;
    const annual =
      last != null && yieldPct != null ? holding.quantity * last * (yieldPct / 100) : null;

    return {
      symbol: holding.symbol,
      name: entry?.name ?? holding.symbol,
      quantity: holding.quantity,
      last,
      yieldPct,
      annual,
      nextPayout: annual != null ? annual / 2 : null,
      nextDate: nextPayoutDate(),
    };
  });
}
