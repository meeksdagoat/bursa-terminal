import { countdownLabel, MACRO_EVENTS } from "./economy-calendar";
import { GLOBAL_MACRO_EVENTS } from "./global-calendar";
import type { BnmPayload, CpiSnapshot, PolicyRate } from "./types";

export type PolicyStance = "BEARISH" | "BULLISH" | "NEUTRAL";

export type PolicyRow = {
  id: string;
  region: string;
  policyLabel: string;
  policyRate: number | null;
  cpiYoy: number | null;
  cpiPeriod: string | null;
  realRate: number | null;
  nextDecision: string | null;
  nextSource: string | null;
  stance: PolicyStance;
};

/**
 * Last published CPI prints used when a live national statistics feed is not
 * wired. Malaysia is replaced by DOSM when `/api/economy` answers.
 */
const CPI_FALLBACKS: Record<string, { yoy: number; period: string }> = {
  my: { yoy: 1.5, period: "2026-07-01" },
  us: { yoy: 2.7, period: "2026-07-01" },
  eu: { yoy: 2.0, period: "2026-07-01" },
  jp: { yoy: 3.1, period: "2026-07-01" },
  cn: { yoy: 0.1, period: "2026-07-01" },
};

const POLICY_FALLBACKS: Record<string, number> = {
  my: 2.75,
  us: 3.63,
  eu: 2.25,
  jp: 0.5,
  cn: 3.0,
};

function nextEvent(sources: string[]): { date: string; source: string } | null {
  const today = new Date();
  const pool = [...MACRO_EVENTS, ...GLOBAL_MACRO_EVENTS]
    .filter((event) => sources.includes(event.source))
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = pool.find((event) => countdownLabel(event.date, today) !== "Passed");
  return upcoming ? { date: upcoming.date, source: upcoming.source } : null;
}

function stanceOf(realRate: number | null, changeBps: number | null): PolicyStance {
  if (changeBps != null && changeBps > 0) return "BEARISH";
  if (changeBps != null && changeBps < 0) return "BULLISH";
  if (realRate == null) return "NEUTRAL";
  if (realRate >= 1.5) return "BEARISH";
  if (realRate <= 0) return "BULLISH";
  return "NEUTRAL";
}

function row(input: {
  id: string;
  region: string;
  policyLabel: string;
  policyRate: number | null;
  changeBps: number | null;
  cpiYoy: number | null;
  cpiPeriod: string | null;
  nextSources: string[];
}): PolicyRow {
  const policyRate = input.policyRate ?? POLICY_FALLBACKS[input.id] ?? null;
  const cpi = input.cpiYoy ?? CPI_FALLBACKS[input.id]?.yoy ?? null;
  const realRate =
    policyRate != null && cpi != null ? Number((policyRate - cpi).toFixed(2)) : null;
  const next = nextEvent(input.nextSources);

  return {
    id: input.id,
    region: input.region,
    policyLabel: input.policyLabel,
    policyRate,
    cpiYoy: cpi,
    cpiPeriod: input.cpiPeriod ?? CPI_FALLBACKS[input.id]?.period ?? null,
    realRate,
    nextDecision: next?.date ?? null,
    nextSource: next?.source ?? null,
    stance: stanceOf(realRate, input.changeBps),
  };
}

export function buildPolicyRows(input: {
  rates: PolicyRate[];
  opr: BnmPayload["opr"] | null;
  malaysiaCpi: CpiSnapshot | null;
}): PolicyRow[] {
  const byId = new Map(input.rates.map((rate) => [rate.id, rate]));
  const fed = byId.get("fed");
  const ecb = byId.get("ecb");
  const boj = byId.get("boj");
  const pboc = byId.get("pboc");

  return [
    row({
      id: "my",
      region: "Malaysia",
      policyLabel: "BNM OPR",
      policyRate: input.opr?.level ?? null,
      changeBps: input.opr?.changeBps ?? null,
      cpiYoy: input.malaysiaCpi?.yoy ?? null,
      cpiPeriod: input.malaysiaCpi?.period ?? null,
      nextSources: ["BNM"],
    }),
    row({
      id: "us",
      region: "United States",
      policyLabel: "Fed Funds",
      policyRate: fed?.rate ?? null,
      changeBps: fed?.changeBps ?? null,
      cpiYoy: null,
      cpiPeriod: null,
      nextSources: ["Fed"],
    }),
    row({
      id: "eu",
      region: "Eurozone",
      policyLabel: "ECB Deposit",
      policyRate: ecb?.rate ?? null,
      changeBps: ecb?.changeBps ?? null,
      cpiYoy: null,
      cpiPeriod: null,
      nextSources: ["ECB"],
    }),
    row({
      id: "jp",
      region: "Japan",
      policyLabel: "BoJ Rate",
      policyRate: boj?.rate ?? null,
      changeBps: boj?.changeBps ?? null,
      cpiYoy: null,
      cpiPeriod: null,
      nextSources: ["BOJ"],
    }),
    row({
      id: "cn",
      region: "China",
      policyLabel: "PBoC 1Y LPR",
      policyRate: pboc?.rate ?? null,
      changeBps: pboc?.changeBps ?? null,
      cpiYoy: null,
      cpiPeriod: null,
      nextSources: ["PBOC"],
    }),
  ];
}
