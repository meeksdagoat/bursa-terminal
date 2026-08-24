/**
 * Ad-hoc probe for candidate Bursa codes: `node scripts/check-codes.mjs 5139 8621`
 * Prints the listed name and last price so a code can be confirmed before it is
 * added to lib/universe.ts.
 */

import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

const codes = process.argv.slice(2);
if (codes.length === 0) {
  console.error("usage: node scripts/check-codes.mjs <code> [code...]");
  process.exit(1);
}

const symbols = codes.map((code) => (code.includes(".") ? code : `${code}.KL`));
const raw = await yahoo.quote(symbols, {}, { validateResult: false });
const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
const found = new Map(rows.filter((row) => row?.symbol).map((row) => [row.symbol, row]));

for (const symbol of symbols) {
  const quote = found.get(symbol);
  if (!quote) {
    console.log(`${symbol.padEnd(12)} NOT FOUND`);
    continue;
  }
  const name = quote.longName ?? quote.shortName ?? "?";
  console.log(`${symbol.padEnd(12)} ${String(quote.regularMarketPrice ?? "—").padEnd(8)} ${name}`);
}
