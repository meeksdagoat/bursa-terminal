import "server-only";

import { fetchHtml } from "./rss";
import type { StructuredWarrant, UniverseEntry, WarrantType, WarrantsPayload } from "./types";
import { fetchQuotes } from "./yahoo";

const SCREENER_RESULTS = "https://www.klsescreener.com/v2/screener_warrants/quote_results";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_WARRANTS = 18;

type DiscoveredWarrant = {
  code: string;
  name: string;
  type: WarrantType;
  expiry: string | null;
  lastPrice: number | null;
};

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function warrantType(name: string, code: string): WarrantType {
  const fromName = name.toUpperCase().match(/([CP])[0-9A-Z]*$/);
  if (fromName?.[1] === "P") return "Put";
  if (fromName?.[1] === "C") return "Call";
  return /p/i.test(code.slice(4)) ? "Put" : "Call";
}

function parseWarrantTable(html: string, motherCode: string): DiscoveredWarrant[] {
  const items: DiscoveredWarrant[] = [];
  const seen = new Set<string>();
  const rowPattern = /<tr[\s\S]*?<\/tr>/gi;

  for (let match = rowPattern.exec(html); match !== null; match = rowPattern.exec(html)) {
    const row = match[0];
    const href = row.match(/href="\/v2\/stocks\/view\/([^"]+)"/i);
    const label = row.match(/href="\/v2\/stocks\/view\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i);
    if (!href || !label) continue;

    const code = href[1].toUpperCase();
    if (code === motherCode.toUpperCase() || seen.has(code)) continue;

    const name = decode(label[1]);
    if (!name) continue;

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decode(cell[1]));
    const expiry = cells.find((cell) => /^\d{4}-\d{2}-\d{2}$/.test(cell)) ?? null;
    const priceCell = cells.find((cell) => /^\d+\.\d+$/.test(cell));

    seen.add(code);
    items.push({
      code,
      name,
      type: warrantType(name, code),
      expiry,
      lastPrice: num(priceCell),
    });
  }

  return items.slice(0, MAX_WARRANTS);
}

async function discoverWarrants(code: string): Promise<DiscoveredWarrant[]> {
  const response = await fetch(SCREENER_RESULTS, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: new URLSearchParams({ m_code: code }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Warrant screener responded ${response.status}`);
  }

  return parseWarrantTable(await response.text(), code);
}

function parseScreenerBoard(html: string): {
  lastPrice: number | null;
  changePct: number | null;
  volume: number | null;
} {
  const lastPrice = num(html.match(/id="price"[^>]*data-value="([^"]+)"/i)?.[1]);
  const diffText = decode(html.match(/id="priceDiff"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const changePct = num(diffText.match(/\(([-+]?\d+(?:\.\d+)?)%\)/)?.[1]);
  const volume = num(decode(html.match(/id="volume"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? ""));
  return { lastPrice, changePct, volume };
}

async function loadScreenerBoard(code: string): Promise<{
  lastPrice: number | null;
  changePct: number | null;
  volume: number | null;
}> {
  try {
    const html = await fetchHtml(`https://www.klsescreener.com/v2/stocks/view/${code}`, 12_000);
    return parseScreenerBoard(html);
  } catch {
    return { lastPrice: null, changePct: null, volume: null };
  }
}

export async function getStructuredWarrants(entry: UniverseEntry): Promise<WarrantsPayload> {
  const discovered = await discoverWarrants(entry.code);
  const yahooSymbols = discovered.map((row) => `${row.code}.KL`);
  const yahooQuotes =
    yahooSymbols.length > 0 ? await fetchQuotes(yahooSymbols).catch(() => []) : [];
  const yahooBySymbol = new Map(yahooQuotes.map((quote) => [quote.symbol.toUpperCase(), quote]));

  const boards = await Promise.all(
    discovered.map(async (row) => {
      const yahoo = yahooBySymbol.get(`${row.code}.KL`);
      if (yahoo?.price != null) {
        return { lastPrice: null, changePct: null, volume: null };
      }
      return loadScreenerBoard(row.code);
    }),
  );

  const items: StructuredWarrant[] = discovered.map((row, index) => {
    const yahoo = yahooBySymbol.get(`${row.code}.KL`);
    const board = boards[index];
    const fromYahoo = yahoo?.price != null;

    return {
      code: row.code,
      symbol: `${row.code}.KL`,
      name: row.name,
      type: row.type,
      lastPrice: fromYahoo ? yahoo.price : (board.lastPrice ?? row.lastPrice),
      changePct: fromYahoo ? yahoo.changePct : board.changePct,
      volume: fromYahoo ? yahoo.volume : board.volume,
      expiry: row.expiry,
      quoteSource: fromYahoo ? "yahoo" : "screener",
    };
  });

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "Call" ? -1 : 1;
    return (b.volume ?? 0) - (a.volume ?? 0);
  });

  return {
    symbol: entry.symbol,
    company: entry.name,
    asOf: new Date().toISOString(),
    items,
  };
}
