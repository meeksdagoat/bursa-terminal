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

const klFullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function isNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

export function formatPct(value: number | null | undefined): string {
  if (!isNumber(value)) return DASH;
  if (value > 0) return `+${value.toFixed(2)}%`;
  if (value < 0) return `-${Math.abs(value).toFixed(2)}%`;
  return `${value.toFixed(2)}%`;
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

/** Compact magnitude without a currency prefix — table cells whose header already says RM. */
export function formatCompact(value: number | null | undefined): string {
  return isNumber(value) ? compactFormatter.format(value) : DASH;
}

export function formatEps(value: number | null | undefined): string {
  if (!isNumber(value)) return DASH;
  const digits = Math.abs(value) >= 1 ? 2 : 3;
  return value.toFixed(digits);
}

export function formatOpr(value: number | null | undefined): string {
  return isNumber(value) ? `${value.toFixed(2)}%` : DASH;
}

/** Unsigned percent for yields and ROE — not a signed P&L move. */
export function formatUnsignedPct(value: number | null | undefined): string {
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

/** High-contrast P&L text against the dark terminal background. */
export function changeClass(value: number | null | undefined): string {
  if (!isNumber(value)) return "text-neutral-400";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-neutral-400";
}

export function changeArrow(value: number | null | undefined): "▲" | "▼" | null {
  if (!isNumber(value) || value === 0) return null;
  return value > 0 ? "▲" : "▼";
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

export function formatKlFullDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? DASH : klFullDateFormatter.format(date);
}

/**
 * Bursa filings often glue the company name onto the headline
 * (`BoardroomHONG LEONG…`). Restore spaces so the row can wrap and clamp.
 */
export function formatEventHeadline(title: string): string {
  return title
    .replace(/\u00a0/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d{1,2}\/\d{1,2}\/\d{2,4})/g, "$1 $2")
    .replace(/(\d)([A-Z]{2,})/g, "$1 $2")
    .replace(/:(?=[A-Za-z])/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

const klDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * News/wire stamps: "Today HH:MM" for same KL calendar day, otherwise
 * day + month + year so older headlines aren't ambiguous across years.
 */
export function formatKlStamp(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;

  const time = klTimeFormatter.format(date);
  return klDayFormatter.format(date) === klDayFormatter.format(new Date())
    ? `Today ${time}`
    : klFullDateFormatter.format(date);
}
