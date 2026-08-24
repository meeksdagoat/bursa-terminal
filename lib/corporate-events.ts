import type {
  CorporateEvent,
  CorporateEventType,
  CorporateEventsPayload,
  EventImpact,
  EventSentiment,
  UniverseEntry,
} from "./types";

/**
 * Deterministic stub timeline until a live events provider is wired.
 *
 * Swap `getCompanyEvents` for an upstream fetch; `CorporateEventsPayload` is
 * the contract the UI already consumes.
 */

export const EVENT_TYPE_LABEL: Record<CorporateEventType, string> = {
  layoffs: "Layoffs",
  ma: "M&A",
  management: "Management",
  expansion: "Expansion",
  contract: "Contract",
  regulatory: "Regulatory",
};

type Template = {
  type: CorporateEventType;
  impact: EventImpact;
  sentiment: EventSentiment;
  title: (name: string, sector: string) => string;
  summary: (name: string, sector: string) => string;
};

const SHARED: Template[] = [
  {
    type: "management",
    impact: "medium",
    sentiment: "neutral",
    title: (name) => `${name} names new group chief executive`,
    summary: (name) =>
      `Board of ${name} announced a CEO succession, with the incoming chief to take over at the next AGM pending shareholder approval.`,
  },
  {
    type: "management",
    impact: "low",
    sentiment: "neutral",
    title: (name) => `${name} refreshes independent directors`,
    summary: (name) =>
      `${name} appointed two independent non-executive directors as part of a scheduled board refresh, with no change to the executive lineup.`,
  },
  {
    type: "ma",
    impact: "high",
    sentiment: "positive",
    title: (name) => `${name} agrees bolt-on acquisition`,
    summary: (name) =>
      `${name} signed a sale-and-purchase agreement for a complementary operating unit. Completion is subject to regulators and a customary due-diligence window.`,
  },
  {
    type: "ma",
    impact: "medium",
    sentiment: "neutral",
    title: (name) => `${name} explores strategic options for a non-core unit`,
    summary: (name) =>
      `Management of ${name} confirmed it is reviewing a potential disposal of a non-core subsidiary. No binding bid has been accepted.`,
  },
  {
    type: "expansion",
    impact: "high",
    sentiment: "positive",
    title: (name) => `${name} commits capex to a new facility`,
    summary: (name) =>
      `${name} approved a multi-year expansion covering plant, equipment and hiring. Management said the spend is funded from internally generated cash and existing facilities.`,
  },
  {
    type: "contract",
    impact: "high",
    sentiment: "positive",
    title: (name) => `${name} wins a multi-year supply contract`,
    summary: (name) =>
      `${name} secured a multi-year contract from a key customer. The award is expected to lift utilisation from the next financial year, subject to call-offs.`,
  },
  {
    type: "contract",
    impact: "medium",
    sentiment: "positive",
    title: (name) => `${name} extends flagship customer agreement`,
    summary: (name) =>
      `An existing customer renewed its offtake agreement with ${name} for a further term. Pricing was described as in line with the expiring contract.`,
  },
  {
    type: "layoffs",
    impact: "high",
    sentiment: "negative",
    title: (name) => `${name} cuts headcount in a restructuring`,
    summary: (name) =>
      `${name} began a workforce reduction across overlapping roles, with one-off costs to be booked in the current quarter. Management framed it as a cost-reset, not a demand shock.`,
  },
  {
    type: "regulatory",
    impact: "high",
    sentiment: "negative",
    title: (name) => `${name} fined after a compliance review`,
    summary: (name) =>
      `A regulator imposed a compound penalty on ${name} following an inspection. The company said it would strengthen internal controls and does not expect a material going-concern impact.`,
  },
  {
    type: "regulatory",
    impact: "medium",
    sentiment: "negative",
    title: (name) => `${name} placed under enhanced supervision`,
    summary: (name) =>
      `${name} was asked to submit a remediation plan after a thematic review. Trading in the shares was not suspended; additional reporting has been requested.`,
  },
];

const SECTOR_EXTRAS: Partial<Record<string, Template[]>> = {
  Banking: [
    {
      type: "layoffs",
      impact: "high",
      sentiment: "negative",
      title: (name) => `${name} trims branch network and support roles`,
      summary: (name) =>
        `${name} will close overlapping branches and reduce back-office headcount as more volume moves onto digital channels. A one-off restructuring charge is expected.`,
    },
    {
      type: "regulatory",
      impact: "high",
      sentiment: "negative",
      title: (name) => `BNM compounds ${name} over AML control gaps`,
      summary: (name) =>
        `Bank Negara Malaysia imposed a compound on ${name} after an AML/CFT examination. The bank said customer deposits are unaffected and a remediation programme is underway.`,
    },
    {
      type: "expansion",
      impact: "medium",
      sentiment: "positive",
      title: (name) => `${name} rolls out additional digital-bank features`,
      summary: (name) =>
        `${name} expanded its digital onboarding and SME working-capital products, targeting fee income outside the branch network.`,
    },
  ],
  Energy: [
    {
      type: "contract",
      impact: "high",
      sentiment: "positive",
      title: (name) => `${name} awarded a production-sharing / FPSO-linked job`,
      summary: (name) =>
        `${name} won a multi-year work package tied to a Malaysian upstream development. First revenue contribution is expected after mobilisation.`,
    },
    {
      type: "expansion",
      impact: "high",
      sentiment: "positive",
      title: (name) => `${name} sanctions a new processing train`,
      summary: (name) =>
        `The board of ${name} approved brownfield expansion to lift throughput. The project is staged so existing operations continue during construction.`,
    },
  ],
  Plantation: [
    {
      type: "expansion",
      impact: "medium",
      sentiment: "positive",
      title: (name) => `${name} adds milling capacity in East Malaysia`,
      summary: (name) =>
        `${name} will add a mill line to cut FFB logistics costs and capture more CPO yield from nearby estates.`,
    },
    {
      type: "regulatory",
      impact: "medium",
      sentiment: "negative",
      title: (name) => `${name} flagged in a sustainability audit`,
      summary: (name) =>
        `A certification body raised non-conformances at selected ${name} estates. The company has 90 days to close the findings or risk a suspended claim.`,
    },
  ],
  Tech: [
    {
      type: "expansion",
      impact: "high",
      sentiment: "positive",
      title: (name) => `${name} adds OSAT / cleanroom capacity`,
      summary: (name) =>
        `${name} is fitting out additional production floor space to meet customer forecasts. Utilisation ramp is expected over the following four quarters.`,
    },
    {
      type: "layoffs",
      impact: "high",
      sentiment: "negative",
      title: (name) => `${name} idles a line and reduces contract staff`,
      summary: (name) =>
        `Softer semiconductor loadings led ${name} to idle one production line and not renew a layer of contract workers. Core engineering headcount is largely intact.`,
    },
  ],
  Construction: [
    {
      type: "contract",
      impact: "high",
      sentiment: "positive",
      title: (name) => `${name} bags a sizeable infrastructure job`,
      summary: (name) =>
        `${name} was awarded a domestic infrastructure package. The job lifts outstanding order book; margin guidance was described as in line with the existing mix.`,
    },
  ],
  Utilities: [
    {
      type: "regulatory",
      impact: "medium",
      sentiment: "neutral",
      title: (name) => `${name} tariff parameters revised`,
      summary: (name) =>
        `The regulator published a new incentive-based parameter set covering ${name}. Management said allowed returns are within the previously flagged range.`,
    },
  ],
  Healthcare: [
    {
      type: "expansion",
      impact: "medium",
      sentiment: "positive",
      title: (name) => `${name} opens additional hospital beds`,
      summary: (name) =>
        `${name} commissioned a new ward block. Ramp-up of occupancy is expected over 12–18 months as specialist clinics are filled.`,
    },
  ],
  Property: [
    {
      type: "expansion",
      impact: "medium",
      sentiment: "positive",
      title: (name) => `${name} launches a new township phase`,
      summary: (name) =>
        `${name} opened bookings for the next phase of an existing township. Take-up in the first weekend will be disclosed with the next quarterly briefing.`,
    },
  ],
};

function hashSymbol(symbol: string): number {
  let hash = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) {
    hash ^= symbol.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDate(rng: () => number, index: number): string {
  const start = Date.UTC(2022, 0, 15);
  const end = Date.UTC(2026, 7, 20);
  const span = end - start;
  const wobble = (rng() * 0.7 + (index / 16) * 0.3) * span;
  const day = new Date(start + wobble);
  day.setUTCHours(10, 0, 0, 0);
  return day.toISOString();
}

export async function getCompanyEvents(entry: UniverseEntry): Promise<CorporateEventsPayload> {
  const rng = mulberry32(hashSymbol(entry.symbol) ^ 0x9e3779b9);
  const pool = [...SHARED, ...(SECTOR_EXTRAS[entry.sector] ?? [])];
  const count = 10 + Math.floor(rng() * 5);
  const used = new Set<number>();
  const items: CorporateEvent[] = [];

  for (let i = 0; i < count; i += 1) {
    let slot = Math.floor(rng() * pool.length);
    if (used.has(slot) && used.size < pool.length) {
      slot = [...pool.keys()].find((index) => !used.has(index)) ?? slot;
    }
    used.add(slot);
    const template = pool[slot];
    const date = pickDate(rng, i);
    items.push({
      id: `${entry.symbol}:${template.type}:${date}`,
      date,
      type: template.type,
      impact: template.impact,
      sentiment: template.sentiment,
      title: template.title(entry.name, entry.sector),
      summary: template.summary(entry.name, entry.sector),
      source: "Stub timeline",
      url: null,
    });
  }

  items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  return {
    source: "stub",
    symbol: entry.symbol,
    company: entry.name,
    asOf: new Date().toISOString(),
    items,
  };
}
