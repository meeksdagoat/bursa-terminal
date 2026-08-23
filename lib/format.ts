const DASH = "—";

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fxFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const klTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "2-digit",
  minute: "2-digit",
});

const klDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  day: "2-digit",
  month: "short",
});

function isNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

export function formatPct(value: number | null | undefined): string {
  if (!isNumber(value)) return DASH;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatPrice(value: number | null | undefined): string {
  return isNumber(value) ? priceFormatter.format(value) : DASH;
}

export function formatFx(value: number | null | undefined): string {
  return isNumber(value) ? fxFormatter.format(value) : DASH;
}

export function formatRatio(value: number | null | undefined): string {
  return isNumber(value) ? value.toFixed(1) : DASH;
}

export function formatMarketCap(value: number | null | undefined): string {
  return isNumber(value) ? `RM ${compactFormatter.format(value)}` : DASH;
}

export function formatVolume(value: number | null | undefined): string {
  return isNumber(value) ? compactFormatter.format(value) : DASH;
}

export function formatOpr(value: number | null | undefined): string {
  return isNumber(value) ? `${value.toFixed(2)}%` : DASH;
}

export function changeClass(value: number | null | undefined): string {
  if (!isNumber(value)) return "text-neutral-500";
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-neutral-400";
}

export function formatKlTime(iso: string | number | null | undefined): string {
  if (iso == null) return DASH;
  const date = typeof iso === "number" ? new Date(iso) : new Date(iso);
  return Number.isNaN(date.getTime()) ? DASH : klTimeFormatter.format(date);
}

export function formatKlDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? DASH : klDateFormatter.format(date);
}
