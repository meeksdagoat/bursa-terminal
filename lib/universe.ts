import type { UniverseEntry } from "./types";

export const KLCI_SYMBOL = "^KLSE";

/**
 * Shariah status is not published by Yahoo Finance, so it is curated here.
 * The FBM KLCI names are taken from the SC list of Shariah-compliant
 * securities; outside the large caps the flag follows the SC's own screening
 * categories (conventional banking and insurance, gaming, brewing, tobacco and
 * entertainment are excluded), so treat it as indicative rather than final.
 */
export const SHARIAH_SOURCE =
  "Curated from the SC Shariah-compliant securities list — indicative, confirm against the latest SC circular";

/** [code, name, sector, shariah] — the symbol is always `${code}.KL`. */
type UniverseSeed = [string, string, string, boolean];

const SEED: UniverseSeed[] = [
  // Banks, insurers and other financials
  ["1155", "Maybank", "Banking", false],
  ["1295", "Public Bank", "Banking", false],
  ["1023", "CIMB Group", "Banking", false],
  ["1066", "RHB Bank", "Banking", false],
  ["5819", "Hong Leong Bank", "Banking", false],
  ["1082", "Hong Leong Financial", "Banking", false],
  ["1015", "AMMB Holdings", "Banking", false],
  ["2488", "Alliance Bank", "Banking", false],
  ["5185", "Affin Bank", "Banking", false],
  ["5258", "Bank Islam", "Banking", true],
  ["1171", "MBSB", "Banking", true],
  ["1818", "Bursa Malaysia", "Financials", true],
  ["5139", "AEON Credit Service", "Financials", false],
  ["5228", "ELK-Desa Resources", "Financials", false],
  ["8621", "LPI Capital", "Insurance", false],
  ["1163", "Allianz Malaysia", "Insurance", false],
  ["6459", "MNRB Holdings", "Insurance", false],
  ["1058", "Manulife Holdings", "Insurance", false],
  ["5230", "Tune Protect", "Insurance", false],
  ["6139", "Takaful Malaysia", "Insurance", true],
  ["9296", "RCE Capital", "Financials", false],
  ["3379", "Insas", "Financials", false],
  ["5301", "CTOS Digital", "Financials", true],

  // Utilities, oil and gas
  ["5347", "Tenaga", "Utilities", true],
  ["4677", "YTL Corp", "Utilities", true],
  ["6742", "YTL Power", "Utilities", true],
  ["5209", "Gas Malaysia", "Utilities", true],
  ["6033", "Petronas Gas", "Utilities", true],
  ["5264", "Malakoff", "Utilities", true],
  ["5183", "Petronas Chem", "Chemicals", true],
  ["5681", "Petronas Dagangan", "Energy", true],
  ["5218", "Vantris Energy", "Energy", false],
  ["7277", "Dialog Group", "Energy", true],
  ["5199", "Hibiscus Petroleum", "Energy", true],
  ["7293", "Yinson Holdings", "Energy", true],
  ["5210", "Bumi Armada", "Energy", true],
  ["5243", "Velesto Energy", "Energy", true],
  ["7250", "UZMA", "Energy", true],
  ["5142", "Wasco", "Energy", true],
  ["0215", "Solarvest", "Energy", true],
  ["0223", "Samaiden Group", "Energy", true],

  // Plantation and agribusiness
  ["1961", "IOI Corp", "Plantation", true],
  ["2445", "Kuala Lumpur Kepong", "Plantation", true],
  ["5285", "SD Guthrie", "Plantation", true],
  ["2291", "Genting Plantations", "Plantation", true],
  ["1899", "Batu Kawan", "Plantation", true],
  ["2089", "United Plantations", "Plantation", true],
  ["5126", "Sarawak Oil Palms", "Plantation", true],
  ["9059", "TSH Resources", "Plantation", true],
  ["5012", "Ta Ann Holdings", "Plantation", true],
  ["5138", "Hap Seng Plantations", "Plantation", true],
  ["5027", "Kim Loong Resources", "Plantation", true],

  // Consumer
  ["4707", "Nestle Malaysia", "Consumer", true],
  ["3689", "Fraser & Neave", "Consumer", true],
  ["7084", "QL Resources", "Consumer", true],
  ["4065", "PPB Group", "Consumer", true],
  ["6599", "AEON Co", "Consumer", true],
  ["5296", "MR DIY Group", "Consumer", true],
  ["5326", "99 Speed Mart", "Consumer", true],
  ["5306", "Farm Fresh", "Consumer", true],
  ["7052", "Padini Holdings", "Consumer", true],
  ["2836", "Carlsberg Brewery", "Consumer", false],
  ["3255", "Heineken Malaysia", "Consumer", false],
  ["4162", "British American Tobacco", "Consumer", false],
  ["3026", "Dutch Lady Milk", "Consumer", true],
  ["5024", "Hup Seng Industries", "Consumer", true],
  ["7237", "Power Root", "Consumer", true],
  ["6432", "Apollo Food", "Consumer", true],
  ["7103", "Spritzer", "Consumer", true],
  ["6351", "Amway Malaysia", "Consumer", true],
  ["2658", "Ajinomoto Malaysia", "Consumer", true],
  ["7216", "Kawan Food", "Consumer", true],
  ["5275", "Mynews Holdings", "Consumer", true],
  ["5196", "Berjaya Food", "Consumer", true],
  ["6633", "Leong Hup International", "Consumer", true],
  ["7252", "Teo Seng Capital", "Consumer", true],
  ["3662", "Malayan Flour Mills", "Consumer", true],
  ["5202", "MSM Malaysia", "Consumer", true],
  ["9288", "Bonia", "Consumer", true],
  ["0157", "Focus Point", "Consumer", true],
  ["5318", "DXN Holdings", "Consumer", true],

  // Healthcare
  ["5225", "IHH Healthcare", "Healthcare", true],
  ["5878", "KPJ Healthcare", "Healthcare", true],
  ["5168", "Hartalega", "Healthcare", true],
  ["7113", "Top Glove", "Healthcare", true],
  ["7153", "Kossan Rubber", "Healthcare", true],
  ["7106", "Supermax", "Healthcare", true],
  ["7148", "Duopharma Biotech", "Healthcare", true],
  ["7081", "Pharmaniaga", "Healthcare", true],
  ["0222", "Optimax Holdings", "Healthcare", true],

  // Technology, semiconductors and EMS
  ["0166", "Inari Amertron", "Tech", true],
  ["0097", "ViTrox", "Tech", true],
  ["3867", "Malaysian Pacific Industries", "Tech", true],
  ["5005", "Unisem", "Tech", true],
  ["0128", "Frontken", "Tech", true],
  ["0208", "Greatech Technology", "Tech", true],
  ["0104", "Genetec Technology", "Tech", true],
  ["0151", "Kelington Group", "Tech", true],
  ["7160", "Pentamaster", "Tech", true],
  ["5292", "UWC", "Tech", true],
  ["0127", "JHM Consolidation", "Tech", true],
  ["5216", "NEXG", "Tech", true],
  ["0138", "Zetrix AI", "Tech", true],
  ["0200", "Revenue Group", "Tech", true],
  ["0176", "Kronologi Asia", "Tech", true],
  ["7204", "D&O Green Technologies", "Tech", true],
  ["7155", "SKP Resources", "Tech", true],
  ["6963", "VS Industry", "Tech", true],
  ["7100", "Uchi Technologies", "Tech", true],
  ["7022", "Globetronics", "Tech", true],
  ["0090", "Elsoft Research", "Tech", true],
  ["0181", "Aemulus Holdings", "Tech", true],
  ["5286", "Mi Technovation", "Tech", true],
  ["9822", "SAM Engineering", "Tech", true],
  ["4456", "Dagang NeXchange", "Tech", true],
  ["5309", "ITMAX System", "Tech", true],

  // Telecommunications and media
  ["6012", "Maxis", "Telco", true],
  ["6947", "CelcomDigi", "Telco", true],
  ["4863", "Telekom Malaysia", "Telco", true],
  ["6888", "Axiata Group", "Telco", true],
  ["5031", "Time dotCom", "Telco", true],
  ["0172", "OCK Group", "Telco", true],
  ["6399", "Astro Malaysia", "Media", false],
  ["4502", "Media Prima", "Media", false],

  // Construction and building materials
  ["5398", "Gamuda", "Construction", true],
  ["3336", "IJM Corp", "Construction", true],
  ["5263", "Sunway Construction", "Construction", true],
  ["1651", "MRCB", "Construction", true],
  ["9679", "WCT Holdings", "Construction", true],
  ["7161", "Kerjaya Prospek", "Construction", true],
  ["5703", "Muhibbah Engineering", "Construction", true],
  ["5253", "Econpile Holdings", "Construction", true],
  ["9261", "Gadang Holdings", "Construction", true],
  ["9598", "Pintaras Jaya", "Construction", true],
  ["8877", "Ekovest", "Construction", true],
  ["5205", "Eversendai", "Construction", true],
  ["3794", "Malayan Cement", "Materials", true],
  ["5000", "Hume Cement", "Materials", true],
  ["6556", "Ann Joo Resources", "Materials", true],
  ["8869", "Press Metal", "Materials", true],
  ["5665", "Southern Steel", "Materials", true],
  ["2852", "Cahya Mata Sarawak", "Materials", true],
  ["5273", "Chin Hin Group", "Materials", true],
  ["5916", "Malaysia Smelting", "Materials", true],

  // Industrial products
  ["4731", "Scientex", "Industrial", true],
  ["7034", "Thong Guan Industries", "Industrial", true],
  ["5100", "BP Plastics", "Industrial", true],
  ["7285", "Tomypak", "Industrial", true],
  ["7248", "SLP Resources", "Industrial", true],
  ["7231", "Wellcall Holdings", "Industrial", true],
  ["5007", "Chin Well Holdings", "Industrial", true],
  ["7089", "Lii Hen Industries", "Industrial", true],
  ["7088", "Poh Huat Resources", "Industrial", true],
  ["5095", "Hevea Board", "Industrial", true],
  ["5160", "Homeritz", "Industrial", true],

  // Property developers
  ["5148", "UEM Sunrise", "Property", true],
  ["8664", "SP Setia", "Property", true],
  ["5288", "Sime Darby Property", "Property", true],
  ["5249", "IOI Properties", "Property", true],
  ["8206", "Eco World Development", "Property", true],
  ["8583", "Mah Sing Group", "Property", true],
  ["5236", "Matrix Concepts", "Property", true],
  ["5789", "LBS Bina Group", "Property", true],
  ["5020", "Glomac", "Property", true],
  ["1724", "Paramount Corp", "Property", true],
  ["5191", "Tambun Indah Land", "Property", true],
  ["5200", "UOA Development", "Property", true],
  ["3743", "Sunsuria", "Property", true],
  ["5606", "IGB Berhad", "Property", true],
  ["5401", "Tropicana Corp", "Property", true],
  ["5038", "KSL Holdings", "Property", true],
  ["6718", "Crescendo Corp", "Property", true],
  ["3158", "YNH Property", "Property", true],
  ["5182", "Avaland", "Property", true],
  ["6017", "SHL Consolidated", "Property", true],

  // REITs
  ["5227", "IGB REIT", "REIT", true],
  ["5235SS", "KLCCP Stapled", "REIT", true],
  ["5212", "Pavilion REIT", "REIT", true],
  ["5176", "Sunway REIT", "REIT", true],
  ["5299", "IGB Commercial REIT", "REIT", true],
  ["5106", "Axis REIT", "REIT", true],
  ["5109", "YTL Hospitality REIT", "REIT", true],
  ["5180", "CapitaLand Malaysia Trust", "REIT", true],
  ["5121", "Hektar REIT", "REIT", true],
  ["5127", "AmanahRaya REIT", "REIT", true],
  ["5269", "Al-Salam REIT", "REIT", true],
  ["5307", "AME REIT", "REIT", true],

  // Gaming and leisure
  ["3182", "Genting", "Gaming", false],
  ["4715", "Genting Malaysia", "Gaming", false],
  ["1562", "Sports Toto", "Gaming", false],
  ["3859", "Magnum", "Gaming", false],

  // Transport and logistics
  ["3816", "MISC", "Transport", true],
  ["5099", "Capital A", "Transport", false],
  ["5238", "AirAsia X", "Transport", false],
  ["5246", "Westports Holdings", "Transport", true],
  ["6521", "Suria Capital", "Transport", true],
  ["5140", "Tasco", "Transport", true],
  ["5303", "Swift Haulage", "Transport", true],
  ["4634", "POS Malaysia", "Transport", true],
  ["5032", "Bintulu Port", "Transport", true],
  ["2062", "Harbour-Link Group", "Transport", true],
  ["0186", "Perak Transit", "Transport", true],

  // Automotive
  ["5248", "Bermaz Auto", "Auto", true],
  ["5983", "MBM Resources", "Auto", true],
  ["4405", "Tan Chong Motor", "Auto", true],
  ["1619", "DRB-Hicom", "Auto", true],
  ["5271", "Pecca Group", "Auto", true],
  ["5015", "APM Automotive", "Auto", true],

  // Diversified holdings
  ["4197", "Sime Darby", "Conglomerate", true],
  ["5211", "Sunway", "Conglomerate", true],
  ["3034", "Hap Seng Consolidated", "Conglomerate", true],
  ["5053", "OSK Holdings", "Conglomerate", false],
  ["3395", "Berjaya Corp", "Conglomerate", false],
  ["4219", "Berjaya Land", "Conglomerate", false],
  ["3107", "Fima Corp", "Conglomerate", true],
  ["6491", "Kumpulan Fima", "Conglomerate", true],
];

export const universe: UniverseEntry[] = SEED.map(([code, name, sector, shariah]) => ({
  symbol: `${code}.KL`,
  code,
  name,
  sector,
  shariah,
}));

export const universeSymbols = universe.map((entry) => entry.symbol);

const bySymbol = new Map(universe.map((entry) => [entry.symbol, entry]));

/** Seeded watchlist for a first visit, before anything is saved locally. */
export const DEFAULT_WATCHLIST = [
  "1155.KL",
  "1295.KL",
  "1023.KL",
  "5347.KL",
  "3182.KL",
  "0166.KL",
  "5183.KL",
  "6012.KL",
];

export function entryBySymbol(symbol: string): UniverseEntry | undefined {
  return bySymbol.get(symbol);
}

export function isTrackedSymbol(symbol: string): boolean {
  return bySymbol.has(symbol);
}

/** Same-sector names first, then other tracked tickers, so thin sectors still fill a matrix. */
export function sectorPeers(symbol: string, limit = 4): string[] {
  const entry = entryBySymbol(symbol);
  if (!entry) return [];
  const same = universe.filter((row) => row.sector === entry.sector && row.symbol !== symbol);
  const rest = universe.filter((row) => row.sector !== entry.sector && row.symbol !== symbol);
  return [...same, ...rest].slice(0, limit).map((row) => row.symbol);
}

/** High-density chart workspace. Optional ticker is applied as `?symbol=`. */
export function terminalHref(symbol?: string): string {
  return symbol ? `/terminal?symbol=${encodeURIComponent(symbol)}` : "/terminal";
}

/**
 * Ranked lookup across ticker code, company name and sector. An empty query
 * returns the head of the universe so the picker opens with content.
 */
export function searchUniverse(query: string, limit = 250): UniverseEntry[] {
  const needle = query.trim().toLowerCase().replace(/\.kl$/, "");
  if (!needle) return universe.slice(0, limit);

  const matches: Array<{ entry: UniverseEntry; score: number }> = [];

  for (const entry of universe) {
    const name = entry.name.toLowerCase();
    const code = entry.code.toLowerCase();

    const score =
      code === needle || name === needle
        ? 0
        : code.startsWith(needle)
          ? 1
          : name.startsWith(needle)
            ? 2
            : name.includes(needle)
              ? 3
              : entry.sector.toLowerCase().startsWith(needle)
                ? 4
                : -1;

    if (score >= 0) matches.push({ entry, score });
  }

  return matches
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function findEntry(
  query: string,
  { shariahOnly = false }: { shariahOnly?: boolean } = {},
): UniverseEntry | undefined {
  const matches = searchUniverse(query, 12);
  return (shariahOnly ? matches.filter((entry) => entry.shariah) : matches)[0];
}

/** Padded so `includes` only matches on whole words: "Insas" never hits "Insasco". */
function padded(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const paddedNames = universe.map((entry) => ({ entry, needle: padded(entry.name) }));

/**
 * Universe members named in free text such as a headline. Used to give the
 * plain-English explainer a subject, and to resolve a story to a Shariah
 * status when the feed itself carries no ticker.
 */
export function mentionedCompanies(text: string): UniverseEntry[] {
  const haystack = padded(text);
  const found: UniverseEntry[] = [];

  for (const { entry, needle } of paddedNames) {
    if (haystack.includes(needle)) found.push(entry);
  }

  return found;
}
