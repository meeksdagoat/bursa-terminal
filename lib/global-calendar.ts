import { countdownLabel, upcomingFrom, type MacroEvent } from "./economy-calendar";

/** Scheduled global macro prints. Dates are KL calendar days. */
export const GLOBAL_MACRO_EVENTS: MacroEvent[] = [
  { id: "fomc-sep", title: "FOMC Rate Decision", date: "2026-09-16", source: "Fed" },
  { id: "uscpi-aug", title: "United States CPI Release", date: "2026-09-11", source: "BLS" },
  { id: "ecb-sep", title: "ECB Monetary Policy Decision", date: "2026-09-11", source: "ECB" },
  { id: "boj-sep", title: "BOJ Policy Rate Decision", date: "2026-09-19", source: "BOJ" },
  { id: "fomc-nov", title: "FOMC Rate Decision", date: "2026-11-04", source: "Fed" },
  { id: "uscpi-sep", title: "United States CPI Release", date: "2026-10-13", source: "BLS" },
  { id: "ecb-oct", title: "ECB Monetary Policy Decision", date: "2026-10-30", source: "ECB" },
  { id: "pboc-sep", title: "PBOC Loan Prime Rate Fixing", date: "2026-09-21", source: "PBOC" },
];

export const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type MacroEventKind = "rate" | "cpi" | "other";

export type DatedMacroEvent = MacroEvent & {
  badge: string;
  kind: MacroEventKind;
};

export function klTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}

export function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday-first index: 0 = Monday … 6 = Sunday. */
export function mondayIndex(year: number, month: number, day = 1): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function macroEventKind(event: Pick<MacroEvent, "title" | "source">): MacroEventKind {
  const hay = `${event.title} ${event.source}`.toLowerCase();
  if (hay.includes("cpi") || hay.includes("inflation")) return "cpi";
  if (/(fed|ecb|boj|pboc|fomc|lpr|opr|rate)/.test(hay)) return "rate";
  return "other";
}

export function decorateMacroEvent(event: MacroEvent, now = new Date()): DatedMacroEvent {
  return { ...event, badge: countdownLabel(event.date, now), kind: macroEventKind(event) };
}

export function allGlobalMacroEvents(now = new Date()): DatedMacroEvent[] {
  return GLOBAL_MACRO_EVENTS.slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => decorateMacroEvent(event, now));
}

export function upcomingGlobalEvents(
  limit = 12,
  now = new Date(),
): DatedMacroEvent[] {
  return upcomingFrom(GLOBAL_MACRO_EVENTS, limit, now).map((event) => ({
    ...event,
    kind: macroEventKind(event),
  }));
}
