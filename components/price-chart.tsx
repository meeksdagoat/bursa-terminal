"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { Jargon } from "@/components/jargon-term";
import { formatKlChartCrosshairTime, formatPrice, formatVolume } from "@/lib/format";
import { formatChartCrosshairTime } from "@/lib/chart-ui";
import type { Candle } from "@/lib/types";

const GAIN = "#22c55e";
const LOSS = "#ef4444";
const GRID = "#1a1a1a";
const AXIS_TEXT = "#737373";
const CROSSHAIR = "#525252";

export type ChartStyle = "candles" | "line";

type PriceChartProps = {
  candles: Candle[];
  style: ChartStyle;
  intraday: boolean;
  up: boolean;
};

export default function PriceChart({ candles, style, intraday, up }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const byTimeRef = useRef<Map<number, Candle>>(new Map());
  const [hovered, setHovered] = useState<Candle | null>(null);

  const accent = up ? GAIN : LOSS;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: AXIS_TEXT,
        fontSize: 10,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID, style: LineStyle.Dotted },
        horzLines: { color: GRID, style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: GRID, entireTextOnly: true },
      localization: {
        locale: "en-US",
        timeFormatter: formatChartCrosshairTime,
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: intraday,
        secondsVisible: false,
        rightOffset: 2,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CROSSHAIR,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#262626",
        },
        horzLine: {
          color: CROSSHAIR,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#262626",
        },
      },
    });

    seriesRef.current =
      style === "candles"
        ? chart.addSeries(CandlestickSeries, {
            upColor: GAIN,
            downColor: LOSS,
            wickUpColor: GAIN,
            wickDownColor: LOSS,
            borderVisible: false,
          })
        : chart.addSeries(LineSeries, {
            color: accent,
            lineWidth: 2,
            priceLineVisible: false,
            crosshairMarkerBorderColor: "#0a0a0a",
            crosshairMarkerBackgroundColor: accent,
          });

    chart.subscribeCrosshairMove((param) => {
      const time = param.time as number | undefined;
      setHovered(time == null ? null : (byTimeRef.current.get(time) ?? null));
    });

    return () => {
      seriesRef.current = null;
      setHovered(null);
      chart.remove();
    };
  }, [style, intraday, accent]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    byTimeRef.current = new Map(candles.map((candle) => [candle.time, candle]));

    if (series.seriesType() === "Candlestick") {
      const data: CandlestickData<UTCTimestamp>[] = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      (series as ISeriesApi<"Candlestick">).setData(data);
    } else {
      const data: LineData<UTCTimestamp>[] = candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.close,
      }));
      (series as ISeriesApi<"Line">).setData(data);
    }
  }, [candles, style, intraday, accent]);

  const readout = hovered ?? candles.at(-1) ?? null;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {readout ? (
        <div className="pointer-events-none absolute left-2 top-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[9px] text-neutral-500">
          <span className="text-neutral-400">{formatKlChartCrosshairTime(readout.time * 1000)}</span>
          {style === "candles" ? (
            <>
              <span>
                O <span className="text-neutral-200">{formatPrice(readout.open)}</span>
              </span>
              <span>
                H <span className="text-neutral-200">{formatPrice(readout.high)}</span>
              </span>
              <span>
                L <span className="text-neutral-200">{formatPrice(readout.low)}</span>
              </span>
            </>
          ) : null}
          <span>
            C <span className="text-neutral-200">{formatPrice(readout.close)}</span>
          </span>
          {/* Re-enables pointer events on the label alone so the definition can
              be opened without handing the whole readout the mouse. */}
          <span className="pointer-events-auto">
            <Jargon term="volume">VOL</Jargon>{" "}
            <span className="text-neutral-200">{formatVolume(readout.volume)}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
