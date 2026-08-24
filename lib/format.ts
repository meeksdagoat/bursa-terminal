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

const ringgitFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shareFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

/** Signed ringgit amount for P&L; unsigned for market value and cost. */
export function formatRinggit(value: number | null | undefined, signed = false): string {
  if (!isNumber(value)) return DASH;
  const body = `RM ${ringgitFormatter.format(Math.abs(value))}`;
  if (!signed) return value < 0 ? `-${body}` : body;
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

export function formatShares(value: number | null | undefined): string {
  return isNumber(value) ? shareFormatter.format(value) : DASH;
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

/**
 * Yahoo quotes the CBOE 10-year (^TNX) as either the yield (4.25) or 10× the
 * yield (42.5). Values above 20 are treated as the 10× convention.
 */
export function formatYield(value: number | null | undefined): string {
  if (!isNumber(value)) return DASH;
  const pct = value > 20 ? value / 10 : value;
  return `${pct.toFixed(2)}%`;
}

export function changeClass(value: number | null | undefined): string {
  if (!isNumber(value)) return "text-neutral-500";
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-neutral-400";
}

/**
 * Yahoo's tape: REGULAR, PRE, POST, POSTPOST (late after-hours), CLOSED.
 * Collapse post-market aliases to a single POST; skip regular hours.
 */
export function postSessionBadge(state: string | null | undefined): "POST" | null {
  if (!state) return null;
  const key = state.trim().toUpperCase();
  if (key === "POST" || key === "POSTPOST" || key === "AFTER-HOURS" || key === "AFTERHOURS") {
    return "POST";
  }
  return null;
}

/** Status-line market state; POSTPOST becomes POST so the label is not doubled. */
export function formatMarketState(state: string | null | undefined): string {
  if (!state) return DASH;
  return postSessionBadge(state) ?? state.trim().toUpperCase();
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

const klDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Clock time for items published today, calendar date for anything older —
 * newswire feeds span several days, and a bare "09:00" on a three-day-old
 * headline reads as breaking news.
 */
export function formatKlStamp(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;

  return klDayFormatter.format(date) === klDayFormatter.format(new Date())
    ? klTimeFormatter.format(date)
    : klDateFormatter.format(date);
}
