import { resolveTopoCountry, TOPO_NAME_TO_ISO2 } from "./world-registry";
import type { GeopoliticalCountryDef } from "./types";

/** Tracked geopolitical states with ISO codes, aliases and map pin coordinates. */
export const GEOPOLITICAL_COUNTRIES: GeopoliticalCountryDef[] = [
  { iso2: "US", iso3: "USA", name: "United States", aliases: ["United States", "U.S.", "US", "America", "Washington", "White House", "Pentagon", "Congress"], coordinates: [-98, 39] },
  { iso2: "CN", iso3: "CHN", name: "China", aliases: ["China", "Chinese", "Beijing", "PRC", "Xi Jinping"], coordinates: [104, 35] },
  { iso2: "RU", iso3: "RUS", name: "Russia", aliases: ["Russia", "Russian", "Moscow", "Kremlin", "Putin"], coordinates: [100, 60] },
  { iso2: "UA", iso3: "UKR", name: "Ukraine", aliases: ["Ukraine", "Ukrainian", "Kyiv", "Kiev", "Zelensky"], coordinates: [32, 49] },
  { iso2: "IL", iso3: "ISR", name: "Israel", aliases: ["Israel", "Israeli", "Tel Aviv", "Jerusalem", "Netanyahu", "IDF"], coordinates: [35, 31] },
  { iso2: "PS", iso3: "PSE", name: "Palestine", aliases: ["Palestine", "Palestinian", "Gaza", "West Bank", "Hamas"], coordinates: [35.2, 31.9] },
  { iso2: "IR", iso3: "IRN", name: "Iran", aliases: ["Iran", "Iranian", "Tehran"], coordinates: [53, 32] },
  { iso2: "TW", iso3: "TWN", name: "Taiwan", aliases: ["Taiwan", "Taiwanese", "Taipei"], coordinates: [121, 24] },
  { iso2: "KP", iso3: "PRK", name: "North Korea", aliases: ["North Korea", "DPRK", "Pyongyang"], coordinates: [127, 40] },
  { iso2: "KR", iso3: "KOR", name: "South Korea", aliases: ["South Korea", "Korean", "Seoul"], coordinates: [128, 36] },
  { iso2: "JP", iso3: "JPN", name: "Japan", aliases: ["Japan", "Japanese", "Tokyo"], coordinates: [138, 36] },
  { iso2: "IN", iso3: "IND", name: "India", aliases: ["India", "Indian", "New Delhi", "Modi"], coordinates: [78, 22] },
  { iso2: "PK", iso3: "PAK", name: "Pakistan", aliases: ["Pakistan", "Pakistani", "Islamabad"], coordinates: [69, 30] },
  { iso2: "AF", iso3: "AFG", name: "Afghanistan", aliases: ["Afghanistan", "Afghan", "Kabul", "Taliban"], coordinates: [67, 33] },
  { iso2: "SY", iso3: "SYR", name: "Syria", aliases: ["Syria", "Syrian", "Damascus"], coordinates: [38, 35] },
  { iso2: "YE", iso3: "YEM", name: "Yemen", aliases: ["Yemen", "Yemeni", "Sanaa", "Houthi"], coordinates: [48, 15] },
  { iso2: "SA", iso3: "SAU", name: "Saudi Arabia", aliases: ["Saudi Arabia", "Saudi", "Riyadh"], coordinates: [45, 24] },
  { iso2: "AE", iso3: "ARE", name: "United Arab Emirates", aliases: ["United Arab Emirates", "UAE", "Dubai", "Abu Dhabi"], coordinates: [54, 24] },
  { iso2: "TR", iso3: "TUR", name: "Turkey", aliases: ["Turkey", "Turkish", "Türkiye", "Ankara", "Erdogan"], coordinates: [35, 39] },
  { iso2: "EG", iso3: "EGY", name: "Egypt", aliases: ["Egypt", "Egyptian", "Cairo"], coordinates: [30, 27] },
  { iso2: "LB", iso3: "LBN", name: "Lebanon", aliases: ["Lebanon", "Lebanese", "Beirut", "Hezbollah"], coordinates: [35.8, 33.9] },
  { iso2: "FR", iso3: "FRA", name: "France", aliases: ["France", "French", "Paris", "Macron"], coordinates: [2, 46] },
  { iso2: "DE", iso3: "DEU", name: "Germany", aliases: ["Germany", "German", "Berlin"], coordinates: [10, 51] },
  { iso2: "GB", iso3: "GBR", name: "United Kingdom", aliases: ["United Kingdom", "Britain", "British", "UK", "London", "Westminster"], coordinates: [-2, 54] },
  { iso2: "IT", iso3: "ITA", name: "Italy", aliases: ["Italy", "Italian", "Rome"], coordinates: [12, 42] },
  { iso2: "ES", iso3: "ESP", name: "Spain", aliases: ["Spain", "Spanish", "Madrid"], coordinates: [-4, 40] },
  { iso2: "PL", iso3: "POL", name: "Poland", aliases: ["Poland", "Polish", "Warsaw"], coordinates: [19, 52] },
  { iso2: "NL", iso3: "NLD", name: "Netherlands", aliases: ["Netherlands", "Dutch", "Amsterdam", "The Hague"], coordinates: [5, 52] },
  { iso2: "EU", iso3: "EUR", name: "European Union", aliases: ["European Union", "EU", "Brussels", "European Commission"], coordinates: [4.3, 50.8] },
  { iso2: "BR", iso3: "BRA", name: "Brazil", aliases: ["Brazil", "Brazilian", "Brasilia", "Brasil"], coordinates: [-55, -10] },
  { iso2: "MX", iso3: "MEX", name: "Mexico", aliases: ["Mexico", "Mexican", "Mexico City"], coordinates: [-102, 23] },
  { iso2: "AR", iso3: "ARG", name: "Argentina", aliases: ["Argentina", "Argentine", "Buenos Aires"], coordinates: [-64, -34] },
  { iso2: "VE", iso3: "VEN", name: "Venezuela", aliases: ["Venezuela", "Venezuelan", "Caracas", "Maduro"], coordinates: [-66, 8] },
  { iso2: "AU", iso3: "AUS", name: "Australia", aliases: ["Australia", "Australian", "Canberra", "Sydney"], coordinates: [133, -25] },
  { iso2: "MM", iso3: "MMR", name: "Myanmar", aliases: ["Myanmar", "Burmese", "Burma", "Naypyidaw"], coordinates: [96, 21] },
  { iso2: "TH", iso3: "THA", name: "Thailand", aliases: ["Thailand", "Thai", "Bangkok"], coordinates: [101, 15] },
  { iso2: "VN", iso3: "VNM", name: "Vietnam", aliases: ["Vietnam", "Vietnamese", "Hanoi"], coordinates: [108, 16] },
  { iso2: "PH", iso3: "PHL", name: "Philippines", aliases: ["Philippines", "Filipino", "Manila"], coordinates: [122, 12] },
  { iso2: "ID", iso3: "IDN", name: "Indonesia", aliases: ["Indonesia", "Indonesian", "Jakarta"], coordinates: [118, -2] },
  { iso2: "MY", iso3: "MYS", name: "Malaysia", aliases: ["Malaysia", "Malaysian", "Kuala Lumpur", "Putrajaya"], coordinates: [102, 4] },
  { iso2: "SG", iso3: "SGP", name: "Singapore", aliases: ["Singapore", "Singaporean"], coordinates: [103.8, 1.3] },
  { iso2: "SD", iso3: "SDN", name: "Sudan", aliases: ["Sudan", "Sudanese", "Khartoum"], coordinates: [30, 15] },
  { iso2: "ET", iso3: "ETH", name: "Ethiopia", aliases: ["Ethiopia", "Ethiopian", "Addis Ababa"], coordinates: [40, 9] },
  { iso2: "NG", iso3: "NGA", name: "Nigeria", aliases: ["Nigeria", "Nigerian", "Abuja", "Lagos"], coordinates: [8, 9] },
  { iso2: "ZA", iso3: "ZAF", name: "South Africa", aliases: ["South Africa", "South African", "Pretoria", "Johannesburg"], coordinates: [25, -29] },
  { iso2: "CD", iso3: "COD", name: "DR Congo", aliases: ["DR Congo", "Congo", "DRC", "Kinshasa"], coordinates: [23, -3] },
  { iso2: "IQ", iso3: "IRQ", name: "Iraq", aliases: ["Iraq", "Iraqi", "Baghdad"], coordinates: [44, 33] },
  { iso2: "CA", iso3: "CAN", name: "Canada", aliases: ["Canada", "Canadian", "Ottawa", "Trudeau"], coordinates: [-106, 56] },
];

const ISO2_LOOKUP = new Map(GEOPOLITICAL_COUNTRIES.map((country) => [country.iso2, country]));

export { TOPO_NAME_TO_ISO2 };

export function countryByIso2(iso2: string | null | undefined): GeopoliticalCountryDef | null {
  if (!iso2) return null;
  return ISO2_LOOKUP.get(iso2.toUpperCase()) ?? null;
}

export function resolveGeoIso2(properties: Record<string, unknown> | undefined): string | null {
  return resolveTopoCountry(properties)?.iso2 ?? null;
}
