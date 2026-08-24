/**
 * Checks every ticker in lib/universe.ts against Yahoo Finance and reports the
 * ones that no longer resolve (renamed, delisted or a wrong board code), plus
 * any local name that has drifted from the listed name.
 *
 *   node scripts/verify-universe.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import YahooFinance from "yahoo-finance2";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK_SIZE = 25;

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

const source = await readFile(path.join(root, "lib/universe.ts"), "utf8");
const seed = [...source.matchAll(/\[\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*(true|false)\s*\]/g)].map(
  ([, code, name, sector]) => ({ symbol: `${code}.KL`, code, name, sector }),
);

if (seed.length === 0) {
  console.error("Could not extract any seed rows from lib/universe.ts");
  process.exit(1);
}

console.log(`Checking ${seed.length} symbols…\n`);

const found = new Map();

for (let index = 0; index < seed.length; index += CHUNK_SIZE) {
  const chunk = seed.slice(index, index + CHUNK_SIZE);
  try {
    const raw = await yahoo.quote(
      chunk.map((entry) => entry.symbol),
      {},
      { validateResult: false },
    );
    for (const row of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      if (row?.symbol) found.set(row.symbol, row);
    }
  } catch (error) {
    console.error(`chunk ${index / CHUNK_SIZE} failed: ${error.message}`);
  }
}

const missing = [];
const drifted = [];

for (const entry of seed) {
  const quote = found.get(entry.symbol);
  if (!quote || quote.regularMarketPrice == null) {
    missing.push(entry);
    continue;
  }

  const listed = quote.longName ?? quote.shortName ?? "";
  const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (listed && !normalise(listed).includes(normalise(entry.name).slice(0, 6))) {
    drifted.push({ ...entry, listed, price: quote.regularMarketPrice });
  }
}

console.log(`RESOLVED: ${seed.length - missing.length}/${seed.length}\n`);

if (missing.length > 0) {
  console.log(`UNRESOLVED (${missing.length}) — remove or fix these codes:`);
  for (const entry of missing) {
    console.log(`  ${entry.symbol.padEnd(12)} ${entry.name} [${entry.sector}]`);
  }
  console.log("");
}

if (drifted.length > 0) {
  console.log(`NAME MISMATCH (${drifted.length}) — local name vs Yahoo listed name:`);
  for (const entry of drifted) {
    console.log(`  ${entry.symbol.padEnd(12)} "${entry.name}"  ->  "${entry.listed}"`);
  }
  console.log("");
}

if (missing.length === 0 && drifted.length === 0) {
  console.log("Universe is clean.");
}
