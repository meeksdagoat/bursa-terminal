/**
 * Builds data/us-tickers.json from NASDAQ Trader symbol directories + S&P 500 overlay.
 *
 *   node scripts/ingest-us-tickers.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NASDAQ_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
const SP500_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";

/** @typedef {{ symbol: string; name: string; exchange: 'NASDAQ' | 'NYSE' | 'S&P 500' }} StockTicker */

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function cleanName(raw) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s+Common Stock$/i, "")
    .replace(/\s+Class [A-Z]\s+Common Stock$/i, "")
    .replace(/\s+American Depositary Shares.*$/i, "")
    .replace(/\s+Ordinary Shares.*$/i, "")
    .replace(/\s+New York Registry Shares.*$/i, "")
    .trim();
}

function isValidSymbol(symbol) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol);
}

function shouldSkipName(name) {
  const lower = name.toLowerCase();
  return (
    lower.includes("warrant") ||
    lower.includes(" rights") ||
    lower.includes(" unit,") ||
    lower.endsWith(" units") ||
    lower.includes(" when issued") ||
    lower.includes("test stock")
  );
}

function parseSp500(csv) {
  /** @type {Set<string>} */
  const symbols = new Set();
  const lines = csv.split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const symbol = line.split(",")[0]?.trim().replace(/"/g, "");
    if (symbol) symbols.add(symbol);
  }
  return symbols;
}

function parseNasdaq(text) {
  /** @type {Map<string, StockTicker>} */
  const map = new Map();
  const lines = text.split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim() || line.startsWith("File Created")) continue;
    const cols = line.split("|");
    const symbol = cols[0]?.trim();
    const name = cleanName(cols[1] ?? "");
    const testIssue = cols[3]?.trim();
    if (!symbol || !name || testIssue === "Y" || !isValidSymbol(symbol) || shouldSkipName(name)) {
      continue;
    }
    map.set(symbol, { symbol, name, exchange: "NASDAQ" });
  }
  return map;
}

function parseOther(text) {
  /** @type {Map<string, StockTicker>} */
  const map = new Map();
  const lines = text.split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim() || line.startsWith("File Created")) continue;
    const cols = line.split("|");
    const symbol = cols[0]?.trim();
    const name = cleanName(cols[1] ?? "");
    const exchangeCode = cols[2]?.trim();
    const testIssue = cols[6]?.trim();
    if (!symbol || !name || testIssue === "Y" || !isValidSymbol(symbol) || shouldSkipName(name)) {
      continue;
    }
    // N = NYSE, P = NYSE Arca, A = NYSE American, Z = Cboe BZX
    const nyseCodes = new Set(["N", "P", "A", "Z"]);
    if (!nyseCodes.has(exchangeCode)) continue;
    map.set(symbol, { symbol, name, exchange: "NYSE" });
  }
  return map;
}

function overlaySp500(tickers, sp500) {
  for (const symbol of sp500) {
    const row = tickers.get(symbol);
    if (row) row.exchange = "S&P 500";
  }
}

async function main() {
  console.log("Fetching NASDAQ Trader symbol directories…");
  const [nasdaqText, otherText, sp500Csv] = await Promise.all([
    fetchText(NASDAQ_URL),
    fetchText(OTHER_URL),
    fetchText(SP500_URL),
  ]);

  const sp500 = parseSp500(sp500Csv);
  const tickers = new Map([
    ...parseNasdaq(nasdaqText),
    ...parseOther(otherText),
  ]);

  overlaySp500(tickers, sp500);

  const rows = [...tickers.values()].sort((left, right) =>
    left.symbol.localeCompare(right.symbol),
  );

  const outDir = path.join(root, "data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "us-tickers.json");
  await writeFile(outPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

  const nasdaqCount = rows.filter((row) => row.exchange === "NASDAQ").length;
  const nyseCount = rows.filter((row) => row.exchange === "NYSE").length;
  const spCount = rows.filter((row) => row.exchange === "S&P 500").length;

  console.log(`Wrote ${rows.length.toLocaleString()} US tickers → ${path.relative(root, outPath)}`);
  console.log(`  NASDAQ: ${nasdaqCount.toLocaleString()}`);
  console.log(`  NYSE:   ${nyseCount.toLocaleString()}`);
  console.log(`  S&P500: ${spCount.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
