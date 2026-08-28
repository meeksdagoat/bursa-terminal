import "server-only";

import { computeQuantFactors } from "./factors";
import type { QuantHubPayload } from "./types";
import { QUANT_FACTOR_OPTIONS } from "./types";
import { universe } from "@/lib/universe";

export async function getQuantHubPayload(): Promise<QuantHubPayload> {
  const { factors, errors } = await computeQuantFactors();

  return {
    asOf: new Date().toISOString(),
    factors,
    factorOptions: QUANT_FACTOR_OPTIONS,
    universeSize: universe.length,
    errors,
  };
}
