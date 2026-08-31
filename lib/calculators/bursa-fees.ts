/** Bursa Malaysia retail contract-cost model (indicative, not a broker quote). */

export const BURSA_STAMP_DUTY_PER_RM1000 = 1;
export const BURSA_STAMP_DUTY_CAP = 1000;
export const BURSA_CLEARING_FEE_RATE = 0.0003;
export const BURSA_CLEARING_FEE_CAP = 1000;
export const BURSA_SST_RATE = 0.08;
export const DEFAULT_BROKERAGE_RATE_PCT = 0.1;
export const DEFAULT_MIN_BROKERAGE = 8;

export type TradeSide = "buy" | "sell";

export type BursaFeeInput = {
  contractValue: number;
  brokerageRatePct: number;
  minBrokerage: number;
};

export type BursaFeeBreakdown = {
  contractValue: number;
  brokerage: number;
  stampDuty: number;
  clearingFee: number;
  sst: number;
  totalFees: number;
  totalPayable: number;
  netProceeds: number;
  effectiveCostPct: number;
};

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function stampDutyOn(contractValue: number): number {
  const value = clampNonNegative(contractValue);
  if (value === 0) return 0;
  return Math.min(BURSA_STAMP_DUTY_CAP, Math.ceil(value / 1000) * BURSA_STAMP_DUTY_PER_RM1000);
}

export function calculateBursaFees(input: BursaFeeInput): BursaFeeBreakdown {
  const contractValue = clampNonNegative(input.contractValue);
  const ratePct = clampNonNegative(input.brokerageRatePct);
  const minBrokerage = clampNonNegative(input.minBrokerage);

  const brokerage = Math.max(minBrokerage, contractValue * (ratePct / 100));
  const stampDuty = stampDutyOn(contractValue);
  const clearingFee = Math.min(BURSA_CLEARING_FEE_CAP, contractValue * BURSA_CLEARING_FEE_RATE);
  const sst = brokerage * BURSA_SST_RATE;
  const totalFees = brokerage + stampDuty + clearingFee + sst;

  return {
    contractValue,
    brokerage,
    stampDuty,
    clearingFee,
    sst,
    totalFees,
    totalPayable: contractValue + totalFees,
    netProceeds: Math.max(0, contractValue - totalFees),
    effectiveCostPct: contractValue > 0 ? (totalFees / contractValue) * 100 : 0,
  };
}
