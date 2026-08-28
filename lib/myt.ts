/** Malaysia Time — all Global Event Calendar stamps convert here. */
export const MYT_TIME_ZONE = "Asia/Kuala_Lumpur";
export const MYT_LABEL = "MYT (UTC+8)";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WALL_TIME = /^(\d{1,2}):(\d{2})$/;

const datePartsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MYT_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function datePartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = datePartsFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  datePartsFormatterCache.set(timeZone, formatter);
  return formatter;
}

function partsMap(instant: Date, timeZone: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of datePartsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}

function isoFromPartsMap(parts: Record<string, string>): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Offset of `timeZone` at `instant`, in minutes east of UTC. */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = partsMap(instant, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Convert a wall-clock stamp in `timeZone` (EST/EDT, CET/CEST, JST, …) to a
 * UTC `Date`. DST is resolved by reading the zone offset at that instant.
 */
export function zonedWallToUtc(dateIso: string, timeHm: string, timeZone: string): Date {
  const dateMatch = ISO_DATE.exec(dateIso);
  const timeMatch = WALL_TIME.exec(timeHm);
  if (!dateMatch || !timeMatch) {
    throw new RangeError(`Invalid zoned wall time: ${dateIso} ${timeHm} ${timeZone}`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  let utc = new Date(wallAsUtc - timeZoneOffsetMinutes(new Date(wallAsUtc), timeZone) * 60_000);
  utc = new Date(wallAsUtc - timeZoneOffsetMinutes(utc, timeZone) * 60_000);
  return utc;
}

export type MytEventTime = {
  releasedAt: string;
  sourceDate: string;
  mytDate: string;
  /** `8:30 PM` */
  time: string;
  /** `8:30 PM MYT` */
  label: string;
  /** `8:30 PM MYT` or `2:00 AM MYT (+1d)` */
  badge: string;
  /** Compact calendar preview, e.g. `8:30PM` / `2:00AM+1` */
  compact: string;
  rolledForward: boolean;
};

function formatMytClock(instant: Date): string {
  return timeFormatter.format(instant).replace(/\u202f/g, " ").replace(/^0/, "");
}

/**
 * Format a source-zone release (UTC / ET / CET / JST / CST) as Malaysia Time.
 * Overnight rollover vs the source calendar day is marked `(+1d)`.
 */
export function formatMytEventTime(
  dateIso: string,
  timeHm: string,
  sourceTimeZone: string,
): MytEventTime {
  const instant = zonedWallToUtc(dateIso, timeHm, sourceTimeZone);
  const sourceDate = isoFromPartsMap(partsMap(instant, sourceTimeZone));
  const mytDate = isoFromPartsMap(partsMap(instant, MYT_TIME_ZONE));
  const time = formatMytClock(instant);
  const compact = time.replace(/\s/g, "");
  const rolledForward = mytDate > sourceDate;

  return {
    releasedAt: instant.toISOString(),
    sourceDate,
    mytDate,
    time,
    label: `${time} MYT`,
    badge: rolledForward ? `${time} MYT (+1d)` : `${time} MYT`,
    compact: rolledForward ? `${compact.replace("AM", "A").replace("PM", "P")}+1` : compact,
    rolledForward,
  };
}

export const MYT_TIME_BADGE_CLASS =
  "inline-flex shrink-0 items-center rounded border border-emerald-800/50 bg-emerald-950/60 px-1.5 py-px font-mono text-[9px] leading-none text-emerald-400";

export const MYT_TIME_BADGE_COMPACT_CLASS =
  "inline-flex whitespace-nowrap rounded border border-emerald-800/50 bg-emerald-950/60 px-0.5 py-px font-mono text-[6px] leading-none tracking-tight text-emerald-400";
