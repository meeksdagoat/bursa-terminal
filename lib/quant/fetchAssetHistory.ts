import "server-only";

import {
  cleanAndForwardFillDailyCloses,
  historyFetchPeriod1,
  normalizeYahooSymbol,
  yahooFetchCandidates,
  type DailyClosePoint,
} from "@/lib/quant/asset-ticker-map";
import { fetchDailyCloses } from "@/lib/yahoo";

export type FetchAssetHistoryResult = {
  /** Series keyed to the caller's requested symbol. */
  requestedSymbol: string;
  /** Yahoo symbol that produced data (may differ after commodity mapping). */
  resolvedSymbol: string;
  points: DailyClosePoint[];
  hardError: string | null;
};

function isHardFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("404") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("not found") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("fetch failed")
  );
}

/**
 * Fetch daily close history with commodity symbol mapping, warm-up buffer,
 * null filtering, and weekday forward-fill.
 */
export async function fetchAssetHistory(
  requestedSymbol: string,
  requestedFrom: Date,
): Promise<FetchAssetHistoryResult> {
  const symbol = requestedSymbol.trim();
  const period1 = historyFetchPeriod1(requestedFrom);
  const candidates = yahooFetchCandidates(symbol);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const raw = await fetchDailyCloses(candidate, period1);
      const points = cleanAndForwardFillDailyCloses(raw);
      if (points.length > 0) {
        return {
          requestedSymbol: symbol,
          resolvedSymbol: candidate,
          points,
          hardError: null,
        };
      }
      errors.push(`${candidate}: empty series after cleaning`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${detail}`);
      if (!isHardFetchError(error) && candidate !== candidates.at(-1)) {
        continue;
      }
    }
  }

  const normalized = normalizeYahooSymbol(symbol);
  return {
    requestedSymbol: symbol,
    resolvedSymbol: normalized,
    points: [],
    hardError: errors.join(" | ") || `No history for ${symbol}`,
  };
}
