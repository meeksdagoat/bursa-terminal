import { ISO3166_ROWS } from "./iso3166-data";

export type WorldCountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
};

const ISO2_LOOKUP = new Map<string, WorldCountryRecord>();
const ISO3_LOOKUP = new Map<string, WorldCountryRecord>();
const NAME_LOOKUP = new Map<string, string>();

for (const row of ISO3166_ROWS) {
  const [iso2, iso3, name] = row.split("|") as [string, string, string];
  const record: WorldCountryRecord = { iso2, iso3, name };
  ISO2_LOOKUP.set(iso2, record);
  ISO3_LOOKUP.set(iso3, record);
  NAME_LOOKUP.set(name.toLowerCase(), iso2);
}

/** Regional anchors + hotspot labels shown when zoom < 2x. */
export const MAJOR_MAP_LABEL_ISO2 = new Set([
  "US",
  "CN",
  "RU",
  "UA",
  "IL",
  "PS",
  "IR",
  "GB",
  "FR",
  "DE",
  "IN",
  "MY",
  "AU",
  "BR",
  "SA",
  "EG",
  "TW",
  "KP",
  "KR",
  "JP",
  "MX",
  "CA",
  "ZA",
  "NG",
  "TR",
  "PK",
  "SY",
  "YE",
  "MM",
  "ID",
]);

/** world-atlas @2/countries-110m.json name overrides when ISO fields are `-99`. */
export const TOPO_NAME_TO_ISO2: Record<string, string> = {
  "United States of America": "US",
  "Russian Federation": "RU",
  "United Kingdom": "GB",
  "Czech Republic": "CZ",
  "Dem. Rep. Congo": "CD",
  "Democratic Republic of the Congo": "CD",
  "Dominican Republic": "DO",
  "Central African Rep.": "CF",
  "Central African Republic": "CF",
  "S. Sudan": "SS",
  "South Sudan": "SS",
  "W. Sahara": "EH",
  "Western Sahara": "EH",
  Palestine: "PS",
  "Cote d'Ivoire": "CI",
  "Bosnia and Herz.": "BA",
  "Bosnia and Herzegovina": "BA",
  "Dominican Rep.": "DO",
  "Eq. Guinea": "GQ",
  "Equatorial Guinea": "GQ",
  "North Macedonia": "MK",
  "Macedonia": "MK",
  "Eswatini": "SZ",
  "Swaziland": "SZ",
  "Timor-Leste": "TL",
  "East Timor": "TL",
  "Cabo Verde": "CV",
  "Cape Verde": "CV",
  "Congo": "CG",
  "Republic of the Congo": "CG",
  "Korea": "KR",
  "South Korea": "KR",
  "North Korea": "KP",
  "Taiwan": "TW",
  "Vietnam": "VN",
  "Viet Nam": "VN",
  "Laos": "LA",
  "Lao PDR": "LA",
  "Burma": "MM",
  "Myanmar": "MM",
  "Syrian Arab Republic": "SY",
  "Iran": "IR",
  "Islamic Republic of Iran": "IR",
  "Türkiye": "TR",
  "Turkey": "TR",
  "United Arab Emirates": "AE",
  "Brunei": "BN",
  "Brunei Darussalam": "BN",
  "Kosovo": "XK",
};

export const WORLD_COUNTRIES: WorldCountryRecord[] = [...ISO2_LOOKUP.values()].sort((left, right) =>
  left.name.localeCompare(right.name),
);

export function worldCountryByIso2(iso2: string | null | undefined): WorldCountryRecord | null {
  if (!iso2) return null;
  return ISO2_LOOKUP.get(iso2.toUpperCase()) ?? null;
}

export function iso2FromIso3(iso3: string | null | undefined): string | null {
  if (!iso3 || iso3.length !== 3 || iso3 === "-99") return null;
  return ISO3_LOOKUP.get(iso3.toUpperCase())?.iso2 ?? null;
}

export function iso2FromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const mapped = TOPO_NAME_TO_ISO2[name];
  if (mapped) return mapped;
  return NAME_LOOKUP.get(name.toLowerCase()) ?? null;
}

export function resolveTopoCountry(properties: Record<string, unknown> | undefined): {
  iso2: string;
  iso3: string | null;
  name: string;
} | null {
  if (!properties) return null;

  const rawIso2 =
    properties.iso_a2 ??
    properties.ISO_A2 ??
    properties.iso_a2_eh ??
    properties.ISO_A2_EH ??
    properties.iso2;

  if (typeof rawIso2 === "string" && rawIso2.length === 2 && rawIso2 !== "-99" && rawIso2 !== "-1") {
    const iso2 = rawIso2.toUpperCase();
    const record = worldCountryByIso2(iso2);
    const name =
      (typeof properties.name === "string" && properties.name) ||
      (typeof properties.NAME === "string" && properties.NAME) ||
      record?.name ||
      iso2;
    return { iso2, iso3: record?.iso3 ?? null, name };
  }

  const rawIso3 = properties.iso_a3 ?? properties.ISO_A3 ?? properties.iso_a3_eh ?? properties.ISO_A3_EH;
  if (typeof rawIso3 === "string" && rawIso3.length === 3 && rawIso3 !== "-99") {
    const iso2 = iso2FromIso3(rawIso3);
    if (iso2) {
      const record = worldCountryByIso2(iso2);
      const name =
        (typeof properties.name === "string" && properties.name) ||
        (typeof properties.NAME === "string" && properties.NAME) ||
        record?.name ||
        iso2;
      return { iso2, iso3: rawIso3.toUpperCase(), name };
    }
  }

  const topoName =
    (typeof properties.name === "string" && properties.name) ||
    (typeof properties.NAME === "string" && properties.NAME) ||
    (typeof properties.admin === "string" && properties.admin) ||
    null;

  const iso2 = iso2FromName(topoName);
  if (!iso2) return null;

  const record = worldCountryByIso2(iso2);
  return {
    iso2,
    iso3: record?.iso3 ?? null,
    name: record?.name ?? topoName ?? iso2,
  };
}

export function displayCountryName(iso2: string, fallback?: string): string {
  return worldCountryByIso2(iso2)?.name ?? fallback ?? iso2;
}
