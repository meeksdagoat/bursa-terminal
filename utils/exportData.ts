/** Client-side CSV export for Quant Hub datasets. */

export type ExportPrimitive = string | number | boolean | null | undefined;

export type ExportRecord = Record<string, ExportPrimitive>;

export type ExportColumn = {
  key: string;
  header: string;
};

export type ExportTable = {
  columns: ExportColumn[];
  records: ExportRecord[];
};

export type ExportPayload = {
  filename: string;
  table: ExportTable;
};

const CSV_MIME = "text/csv;charset=utf-8";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/;

export function toIsoDateString(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : Number.NaN;
    if (!Number.isFinite(ms)) return "";
    return new Date(ms).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (ISO_DATE.test(text)) return text.slice(0, 10);
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function addCalendarDaysIso(baseIso: string, days: number): string {
  const iso = toIsoDateString(baseIso);
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeExportNumber(value: number | null | undefined, digits = 6): string {
  if (value == null || !Number.isFinite(value)) return "";
  const fixed = value.toFixed(digits);
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/\.?0+$/, "") || "0";
}

export function exportFilenameStem(prefix: string): string {
  const slug = prefix
    .replace(/\.KL$/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug || "export"}-${todayIsoDate()}`;
}

export function stampExportFilename(prefix: string, ext = "csv"): string {
  return `${exportFilenameStem(prefix)}.${ext}`;
}

export function escapeCsvValue(value: ExportPrimitive): string {
  const text = formatExportCell(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

export function formatExportCell(value: ExportPrimitive): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return normalizeExportNumber(value);
  const text = String(value);
  if (ISO_DATE.test(text)) return toIsoDateString(text);
  return text;
}

export function tableToCsv(table: ExportTable): string {
  const header = table.columns.map((column) => escapeCsvValue(column.header)).join(",");
  const lines = table.records.map((record) =>
    table.columns.map((column) => escapeCsvValue(record[column.key])).join(","),
  );
  return [header, ...lines].join("\r\n");
}

function triggerBlobDownload(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(filename: string, table: ExportTable): void {
  triggerBlobDownload(filename, `\uFEFF${tableToCsv(table)}`, CSV_MIME);
}

export function isExportTableEmpty(table: ExportTable): boolean {
  return table.records.length === 0;
}
