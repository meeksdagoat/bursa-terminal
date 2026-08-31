import type { BacktestEquityPoint, BacktestSignal } from "@/lib/quant/backtest";
import {
  CHART_MARKER_DENSE_BAR_THRESHOLD,
  CHART_MAX_LINE_POINTS,
  CHART_MAX_VISIBLE_MARKERS,
  downsampleLttb,
} from "@/lib/quant/lttb";

export function downsampleEquityCurveForChart(
  curve: BacktestEquityPoint[],
  maxPoints = CHART_MAX_LINE_POINTS,
): BacktestEquityPoint[] {
  if (curve.length <= maxPoints) return curve;
  return downsampleLttb(curve, maxPoints, (point) => point.strategy);
}

export function selectVisibleChartMarkers(input: {
  signals: BacktestSignal[];
  barCount: number;
  maxMarkers?: number;
  denseThreshold?: number;
}): BacktestSignal[] {
  const maxMarkers = input.maxMarkers ?? CHART_MAX_VISIBLE_MARKERS;
  const denseThreshold = input.denseThreshold ?? CHART_MARKER_DENSE_BAR_THRESHOLD;

  if (input.barCount <= denseThreshold) return input.signals;
  if (input.signals.length <= maxMarkers) return input.signals;

  const stride = input.signals.length / maxMarkers;
  return Array.from({ length: maxMarkers }, (_, index) => {
    const pick = Math.min(
      input.signals.length - 1,
      Math.floor(index * stride + stride * 0.5),
    );
    return input.signals[pick]!;
  });
}

export function buildChartMarkerLookup(
  signals: BacktestSignal[],
  equityCurve: BacktestEquityPoint[],
): Map<string, BacktestSignal> {
  const visible = selectVisibleChartMarkers({
    signals,
    barCount: equityCurve.length,
  });
  const map = new Map<string, BacktestSignal>();
  for (const signal of visible) map.set(signal.date, signal);
  return map;
}
