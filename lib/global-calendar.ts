import { upcomingFrom, type MacroEvent } from "./economy-calendar";

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

export function upcomingGlobalEvents(
  limit = 6,
  now = new Date(),
): Array<MacroEvent & { badge: string }> {
  return upcomingFrom(GLOBAL_MACRO_EVENTS, limit, now);
}
