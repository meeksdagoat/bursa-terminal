/** Scheduled Malaysian macro prints. Dates are KL calendar days. */

export type MacroEvent = {
  id: string;
  title: string;
  date: string;
  source: string;
};

export const MACRO_EVENTS: MacroEvent[] = [
  { id: "opr-sep", title: "BNM OPR Decision Meeting", date: "2026-09-03", source: "BNM" },
  { id: "cpi-aug", title: "DOSM August CPI Release", date: "2026-09-24", source: "DOSM" },
  { id: "budget-2027", title: "Budget 2027 Tabling", date: "2026-10-10", source: "MOF" },
  { id: "trade-jul", title: "DOSM External Trade (July)", date: "2026-08-28", source: "DOSM" },
  { id: "gdp-q3", title: "DOSM Q3 GDP Advance Print", date: "2026-11-14", source: "DOSM" },
];

function klDayStamp(value: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Date.UTC(year, month - 1, day);
}

export function countdownLabel(isoDate: string, now = new Date()): string {
  const event = klDayStampFromIso(isoDate);
  if (!Number.isFinite(event)) return isoDate;
  const days = Math.round((event - klDayStamp(now)) / 86_400_000);

  if (days < 0) return "Passed";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 13) return `In ${days} Days`;
  return "Next Month";
}

function klDayStampFromIso(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

export function upcomingFrom(
  events: MacroEvent[],
  limit = 4,
  now = new Date(),
): Array<MacroEvent & { badge: string }> {
  const today = klDayStamp(now);
  return events
    .filter((event) => klDayStampFromIso(event.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map((event) => ({ ...event, badge: countdownLabel(event.date, now) }));
}

export function upcomingEvents(limit = 4, now = new Date()): Array<MacroEvent & { badge: string }> {
  return upcomingFrom(MACRO_EVENTS, limit, now);
}
