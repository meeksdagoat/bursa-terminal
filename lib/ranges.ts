/** Client-safe chart range constants; keep free of server-only imports. */

export const RANGE_KEYS = ["1D", "5D", "1M", "6M", "1Y"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export function isRangeKey(value: string | null): value is RangeKey {
  return RANGE_KEYS.includes(value as RangeKey);
}
