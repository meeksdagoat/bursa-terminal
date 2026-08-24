import type { Quote } from "./types";

export type FeedStatus = "live" | "delayed" | "closed" | "connecting" | "reconnecting" | "error";

const KL_TZ = "Asia/Kuala_Lumpur";

const klWeekday = new Intl.DateTimeFormat("en-US", {
  timeZone: KL_TZ,
  weekday: "short",
});

const klClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Bursa Malaysia continuous session: 09:00–12:30 and 14:30–17:00 MYT, weekdays. */
export function isBursaOpen(at: Date = new Date()): boolean {
  const weekday = klWeekday.format(at);
  if (weekday === "Sat" || weekday === "Sun") return false;

  const [hours, minutes] = klClock.format(at).split(":").map(Number);
  const stamp = hours * 60 + minutes;
  const morning = stamp >= 9 * 60 && stamp < 12 * 60 + 30;
  const afternoon = stamp >= 14 * 60 + 30 && stamp < 17 * 60;
  return morning || afternoon;
}

function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toUpperCase();
}

/**
 * LIVE during the regular session, DELAYED 15M in pre-market, MARKET CLOSED after hours.
 * Yahoo's tape is used when present; the KL session clock overrides stale POST.
 */
export function resolveFeedStatus(input: {
  marketState?: string | null;
  delayMinutes?: number | null;
  connected: boolean;
  error?: string | null;
  loading?: boolean;
}): FeedStatus {
  if (input.error && input.connected) return "reconnecting";
  if (input.error && !input.connected) return "error";
  if (!input.connected) return input.loading ? "connecting" : "error";

  const state = normalizeState(input.marketState);
  const delayedTape =
    state === "PRE" ||
    state === "PREPRE" ||
    state === "POST" ||
    state === "POSTPOST" ||
    state === "AFTER-HOURS" ||
    state === "AFTERHOURS";

  // Yahoo stays in POST long after the close. Prefer the KL session clock so
  // the pill reads MARKET CLOSED after 17:00, DELAYED 15M only around the open.
  if (state === "REGULAR") {
    return (input.delayMinutes ?? 0) >= 15 ? "delayed" : "live";
  }
  if (delayedTape) {
    if (isBursaOpen()) return (input.delayMinutes ?? 0) >= 15 ? "delayed" : "live";
    if (state === "PRE" || state === "PREPRE") return "delayed";
    return "closed";
  }
  if (state === "CLOSED") return "closed";

  if (isBursaOpen()) return (input.delayMinutes ?? 0) >= 15 ? "delayed" : "live";
  return "closed";
}

export function feedStatusFromQuote(
  quote: Quote | null | undefined,
  extras: { connected: boolean; error?: string | null; loading?: boolean },
): FeedStatus {
  return resolveFeedStatus({
    marketState: quote?.marketState,
    delayMinutes: quote?.delayMinutes,
    connected: extras.connected,
    error: extras.error,
    loading: extras.loading,
  });
}

export function bursaTickSize(price: number): number {
  if (price < 1) return 0.005;
  if (price < 10) return 0.01;
  if (price < 50) return 0.02;
  if (price < 100) return 0.05;
  return 0.1;
}
