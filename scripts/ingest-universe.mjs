/**
 * Builds data/bursa-universe.json from KLSE Screener's public roster plus the
 * curated overlays in lib/universe-curated.ts (or the seed still in universe.ts).
 *
 *   node scripts/ingest-universe.mjs
 *
 * Existing codes keep their listing name, short sector label, Shariah flag and
 * aliases. New Main / ACE / LEAP names are appended.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROW_RE =
  /<td title="([^"]+)"><a href="\/v2\/stocks\/view\/([^/"]+)\/[^"]*"[^>]*>([^<]+)<\/a>([\s\S]*?)<\/td>\s*<td title="Code">([^<]+)<\/td>\s*<td title="Category"><small>([^<]*)<\/small><br\/><small class="text-muted">\s*([^<]+)<\/small>/g;

const SEED_RE = /\[\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*(true|false)\s*\]/g;
const ALIAS_RE = /"([^"]+)":\s*\[([^\]]*)\]/g;

function titleCase(value) {
  return value
    .toLowerCase()
    .replace(/\b([a-z0-9])/g, (char) => char.toUpperCase())
    .replace(/\bBerhad\b/g, "Berhad")
    .replace(/\bBhd\.?\b/g, "Bhd");
}

function displayName(fullName, shortName) {
  const cleaned = titleCase(fullName)
    .replace(/\s+(Holdings\s+)?(Berhad|Bhd)\.?$/i, "")
    .replace(/\s+Group$/i, " Group")
    .trim();
  return cleaned || titleCase(shortName);
}

function parseMarket(muted) {
  const text = muted.toLowerCase();
  if (text.includes("leap")) return "LEAP";
  if (text.includes("ace")) return "ACE";
  return "MAIN";
}

function parseSector(muted) {
  const sector = muted.split(",")[0]?.trim() ?? "Unclassified";
  return sector || "Unclassified";
}

function isEquityCode(code) {
  return /^\d{4,5}(SS)?$/i.test(code);
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

async function readOverlays() {
  const candidates = ["lib/universe-curated.ts", "lib/universe.ts"];
  let source = "";
  for (const relative of candidates) {
    try {
      source = await readFile(path.join(root, relative), "utf8");
      if (SEED_RE.test(source) || source.includes("CURATED_SEED")) break;
    } catch {
      source = "";
    }
  }
  SEED_RE.lastIndex = 0;

  const seed = new Map();
  const seedOrder = [];
  for (const match of source.matchAll(SEED_RE)) {
    seedOrder.push(match[1]);
    seed.set(match[1], {
      code: match[1],
      name: match[2],
      sector: match[3],
      shariah: match[4] === "true",
    });
  }

  const aliases = {};
  const aliasBlock = source.match(/TICKER_ALIASES[\s\S]*?= \{([\s\S]*?)^\};/m);
  if (aliasBlock) {
    for (const match of aliasBlock[1].matchAll(ALIAS_RE)) {
      aliases[match[1]] = [...match[2].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    }
  }

  return { seed, seedOrder, aliases };
}

function parseRoster(html) {
  const rows = [];
  for (const match of html.matchAll(ROW_RE)) {
    const [, fullNameRaw, hrefCode, shortNameRaw, flagChunk, codeRaw] = match;
    const muted = match[7];
    const code = codeRaw.trim();
    if (!isEquityCode(code) && !isEquityCode(hrefCode)) continue;
    const resolved = isEquityCode(code) ? code : hrefCode;
    rows.push({
      code: resolved,
      shortName: shortNameRaw.trim().toUpperCase(),
      fullName: titleCase(fullNameRaw.trim()),
      sector: parseSector(muted),
      market: parseMarket(muted),
      shariah: /Shariah Compliant/.test(flagChunk),
    });
  }
  return rows;
}

const { seed, seedOrder, aliases } = await readOverlays();
const html = await readFile(path.join(root, "data/raw/klse-quote.html"), "utf8");
const roster = parseRoster(html);

if (roster.length < 800) {
  console.error(`Parsed only ${roster.length} roster rows — aborting so the curated universe is not replaced with a partial dump.`);
  process.exit(1);
}

const byCode = new Map();
for (const row of roster) {
  if (!byCode.has(row.code)) byCode.set(row.code, row);
}

for (const overlay of seed.values()) {
  if (!byCode.has(overlay.code)) {
    byCode.set(overlay.code, {
      code: overlay.code,
      shortName: (aliases[overlay.code]?.[0] ?? overlay.name).toUpperCase().replace(/\s+/g, ""),
      fullName: overlay.name,
      sector: overlay.sector,
      market: overlay.code.startsWith("0") && overlay.code.length === 4 ? "ACE" : overlay.code.startsWith("03") ? "LEAP" : "MAIN",
      shariah: overlay.shariah,
    });
  }
}

const merged = [...byCode.values()]
  .map((row) => {
    const overlay = seed.get(row.code);
    const extra = aliases[row.code] ?? [];
    const name = overlay?.name ?? displayName(row.fullName, row.shortName);
    const sector = overlay?.sector ?? row.sector;
    const shariah = overlay?.shariah ?? row.shariah;
    return {
      code: row.code,
      shortName: row.shortName,
      name,
      fullName: row.fullName || name,
      sector,
      market: row.market,
      shariah,
      aliases: unique([row.shortName, row.fullName, ...extra]),
    };
  })
  .sort((a, b) => {
    const aIdx = seedOrder.indexOf(a.code);
    const bIdx = seedOrder.indexOf(b.code);
    const aRank = aIdx === -1 ? Number.POSITIVE_INFINITY : aIdx;
    const bRank = bIdx === -1 ? Number.POSITIVE_INFINITY : bIdx;
    if (aRank !== bRank) return aRank - bRank;
    return a.code.localeCompare(b.code, "en", { numeric: true });
  });

await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data/bursa-universe.json"), `${JSON.stringify(merged, null, 2)}\n`, "utf8");

const boards = { MAIN: 0, ACE: 0, LEAP: 0 };
const shariahCount = merged.filter((row) => row.shariah).length;
for (const row of merged) boards[row.market] += 1;

console.log(`Wrote ${merged.length} tickers → data/bursa-universe.json`);
console.log(`  MAIN ${boards.MAIN} · ACE ${boards.ACE} · LEAP ${boards.LEAP} · Shariah ${shariahCount}`);
console.log(`  Preserved ${seed.size} curated overlays`);
