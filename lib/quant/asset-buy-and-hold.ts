import { barKeyFromUnix, type BacktestTimeframe } from "@/lib/quant/backtest-timeframe";
import type { AssetBuyAndHoldPoint, BacktestHistoryBar } from "@/lib/types";

export function computeAssetBuyAndHold(input: {
  bars: BacktestHistoryBar[];
  timeframe: BacktestTimeframe;
  initialCapital: number;
}): { curve: AssetBuyAndHoldPoint[]; returnPct: number | null } {
  const sorted = [...input.bars]
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0)
    .sort((left, right) => left.time - right.time);

  if (sorted.length === 0) {
    return { curve: [], returnPct: null };
  }

  const startClose = sorted[0].close;
  const curve = sorted.map((bar) => ({
    timestamp: barKeyFromUnix(bar.time, input.timeframe),
    value: input.initialCapital * (bar.close / startClose),
  }));

  const finalValue = curve.at(-1)?.value ?? input.initialCapital;
  const returnPct = ((finalValue - input.initialCapital) / input.initialCapital) * 100;

  return { curve, returnPct };
}
