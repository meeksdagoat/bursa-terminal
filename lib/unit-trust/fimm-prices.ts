import "server-only";

import { fetchHtml } from "@/lib/rss";

const FIMM_DAILY_PRICE_URL = "https://www.fimm.com.my/report/dailyprice.php";

export type FimmPriceBook = {
  priceDate: string | null;
  asOf: string;
  byName: Map<string, number>;
};

const MANAGER_MARKERS = [
  "SDN BHD",
  "SDN. BHD",
  "BERHAD",
  "BHD.",
  "BHD",
  "LIMITED",
  "LTD",
  "INC.",
  "GMBH",
] as const;

const INLINE_PRICE =
  /^(.+?)\s*\([a-z0-9]+\)\s*(?:z\d+\s+)?(\d+\.\d{4}|NA)\s*$/i;
const TRAILING_PRICE = /^(.+?)\s+(\d+\.\d{4})\s*$/;
const PRICE_ONLY = /^(\d+\.\d{4}|NA)$/i;
const GLUED_PRICE = /^(.+?)(\d+\.\d{4})\s*$/;

function normalizeName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isManagerLine(line: string): boolean {
  const upper = line.toUpperCase();
  if (upper === "NAV" || upper === "RM") return true;
  if (/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(upper)) {
    return true;
  }
  return MANAGER_MARKERS.some((marker) => upper.includes(marker));
}

function parsePriceDate(lines: string[]): string | null {
  for (const line of lines.slice(0, 6)) {
    const match = line.match(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+\w+\s+\d{4}\b/i,
    );
    if (match) return match[0];
  }
  return null;
}

/** Parse FIMM's plain-text daily unit trust price bulletin. */
export function parseFimmDailyPrices(raw: string): FimmPriceBook {
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const priceDate = parsePriceDate(lines);
  const byName = new Map<string, number>();
  let buffer = "";

  const commit = (name: string, priceToken: string) => {
    const normalized = normalizeName(name);
    if (!normalized || priceToken.toUpperCase() === "NA") return;
    const nav = Number.parseFloat(priceToken);
    if (Number.isFinite(nav)) {
      byName.set(normalized, nav);
    }
  };

  const flush = (priceToken: string) => {
    if (!buffer) return;
    commit(buffer, priceToken);
    buffer = "";
  };

  for (const line of lines) {
    if (line === "NAV" || line === "RM") continue;

    const inline = line.match(INLINE_PRICE);
    if (inline) {
      commit(inline[1], inline[2]);
      buffer = "";
      continue;
    }

    const glued = line.match(GLUED_PRICE);
    if (glued && !isManagerLine(glued[1])) {
      commit(glued[1], glued[2]);
      buffer = "";
      continue;
    }

    const priceOnly = line.match(PRICE_ONLY);
    if (priceOnly && buffer) {
      flush(priceOnly[1]);
      continue;
    }

    const trailing = line.match(TRAILING_PRICE);
    if (trailing && !isManagerLine(trailing[1])) {
      commit(trailing[1], trailing[2]);
      buffer = "";
      continue;
    }

    if (isManagerLine(line)) {
      buffer = "";
      continue;
    }

    buffer = buffer ? `${buffer} ${line}` : line;
  }

  return {
    priceDate,
    asOf: new Date().toISOString(),
    byName,
  };
}

export async function fetchFimmDailyPrices(): Promise<FimmPriceBook> {
  const html = await fetchHtml(FIMM_DAILY_PRICE_URL, 12_000);
  return parseFimmDailyPrices(html);
}

export function resolveFimmNav(
  book: FimmPriceBook,
  patterns: readonly string[],
): number | null {
  for (const pattern of patterns) {
    const key = normalizeName(pattern);
    const direct = book.byName.get(key);
    if (direct != null) return direct;

    for (const [name, nav] of book.byName) {
      if (name === key) return nav;
    }
  }
  return null;
}
