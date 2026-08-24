"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Jargon } from "@/components/jargon-term";
import { formatKlTime, formatPrice, formatVolume } from "@/lib/format";
import {
  FIB_LEVELS,
  emaOverlay,
  macdOverlay,
  rsiOverlay,
  smaOverlay,
  toHeikinAshi,
  volumeProfile,
  type VolumeBin,
} from "@/lib/chart-overlays";
import type { ChartType } from "@/lib/ranges";
import type { Candle } from "@/lib/types";
import { EMPTY_OVERLAYS, type ChartOverlays, type DrawingTool } from "@/lib/chart-ui";

const GAIN = "#22c55e";
const LOSS = "#ef4444";
const GRID = "#1a1a1a";
const AXIS_TEXT = "#737373";
const CROSSHAIR = "#525252";
const BACKGROUND = "#0a0a0a";
const KL_TZ = "Asia/Kuala_Lumpur";

const SMA_COLORS = { 20: "#38bdf8", 50: "#eab308", 200: "#c084fc" } as const;
const EMA_COLOR = "#f97316";

const klYear = new Intl.DateTimeFormat("en-GB", { timeZone: KL_TZ, year: "numeric" });
const klMonth = new Intl.DateTimeFormat("en-GB", { timeZone: KL_TZ, month: "short" });
const klDay = new Intl.DateTimeFormat("en-GB", { timeZone: KL_TZ, day: "2-digit" });
const klClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const klCrosshair = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toChartDate(time: Time): Date | null {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") {
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (time && typeof time === "object" && "year" in time) {
    return new Date(Date.UTC(time.year, time.month - 1, time.day));
  }
  return null;
}

function formatKlTick(time: Time, tickMarkType: TickMarkType): string | null {
  const date = toChartDate(time);
  if (!date) return null;
  switch (tickMarkType) {
    case TickMarkType.Year:
      return klYear.format(date);
    case TickMarkType.Month:
      return klMonth.format(date);
    case TickMarkType.DayOfMonth:
      return klDay.format(date);
    case TickMarkType.Time:
    case TickMarkType.TimeWithSeconds:
      return klClock.format(date);
    default:
      return null;
  }
}

function formatKlCrosshairTime(time: Time): string {
  const date = toChartDate(time);
  return date ? klCrosshair.format(date) : "";
}

type ChartPoint = { time: number; price: number };

type Drawing =
  | { id: string; kind: "trendline"; a: ChartPoint; b: ChartPoint }
  | { id: string; kind: "hline"; price: number }
  | { id: string; kind: "fib"; a: ChartPoint; b: ChartPoint };

type StockCandlestickChartProps = {
  candles: Candle[];
  chartType?: ChartType;
  overlays?: ChartOverlays;
  drawingTool?: DrawingTool;
  onDrawingComplete?: () => void;
};

const TIME_SCALE = {
  borderColor: GRID,
  timeVisible: true,
  secondsVisible: false,
  rightOffset: 12,
  barSpacing: 6,
} as const;

function applyContainerSize(chart: IChartApi, container: HTMLElement) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width < 1 || height < 1) return;
  chart.applyOptions({ width, height });
}

function fitTimeScale(chart: IChartApi, barCount: number) {
  chart.timeScale().applyOptions({
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 12,
    barSpacing: 6,
  });
  chart.timeScale().fitContent();
  if (barCount > 0) {
    chart.timeScale().setVisibleLogicalRange({
      from: 0,
      to: barCount - 1 + 12,
    });
  }
}

function toOhlc(candles: Candle[]): CandlestickData<UTCTimestamp>[] {
  return candles.map((candle) => ({
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function toVolume(candles: Candle[]): HistogramData<UTCTimestamp>[] {
  return candles.map((candle) => ({
    time: candle.time as UTCTimestamp,
    value: candle.volume ?? 0,
    color: candle.close >= candle.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
  }));
}

function toLine(candles: Candle[]): LineData<UTCTimestamp>[] {
  return candles.map((candle) => ({
    time: candle.time as UTCTimestamp,
    value: candle.close,
  }));
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type PriceMapper = {
  timeToX: (time: number) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => number | null;
  yToPrice: (y: number) => number | null;
  width: number;
};

export function StockCandlestickChart({
  candles,
  chartType = "candlestick",
  overlays = EMPTY_OVERLAYS,
  drawingTool = "cursor",
  onDrawingComplete,
}: StockCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const byTimeRef = useRef<Map<number, Candle>>(new Map());
  const barCountRef = useRef(0);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draft, setDraft] = useState<ChartPoint | null>(null);
  const [cursor, setCursor] = useState<ChartPoint | null>(null);
  const [mapper, setMapper] = useState<PriceMapper | null>(null);
  const [profile, setProfile] = useState<VolumeBin[]>([]);

  const displayCandles = useMemo(
    () => (chartType === "heikin-ashi" ? toHeikinAshi(candles) : candles),
    [candles, chartType],
  );

  const overlayKey = `${overlays.rsi ? 1 : 0}${overlays.macd ? 1 : 0}${chartType}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: BACKGROUND },
        textColor: AXIS_TEXT,
        fontSize: 10,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID, style: LineStyle.Dotted },
        horzLines: { color: GRID, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: GRID,
        entireTextOnly: true,
        scaleMargins: { top: 0.05, bottom: overlays.rsi || overlays.macd ? 0.08 : 0.28 },
      },
      localization: {
        timeFormatter: formatKlCrosshairTime,
      },
      timeScale: {
        ...TIME_SCALE,
        tickMarkFormatter: formatKlTick,
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
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const mainSeries =
      chartType === "line"
        ? chart.addSeries(LineSeries, {
            color: GAIN,
            lineWidth: 2,
            crosshairMarkerVisible: true,
          })
        : chart.addSeries(CandlestickSeries, {
            upColor: GAIN,
            downColor: LOSS,
            wickUpColor: GAIN,
            wickDownColor: LOSS,
            borderVisible: false,
          });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    chart.priceScale("").applyOptions({
      scaleMargins: { top: overlays.rsi || overlays.macd ? 0.82 : 0.78, bottom: 0 },
    });

    let rsiSeries: ISeriesApi<"Line"> | null = null;
    let macdLine: ISeriesApi<"Line"> | null = null;
    let macdSignal: ISeriesApi<"Line"> | null = null;
    let macdHist: ISeriesApi<"Histogram"> | null = null;

    const panes = chart.panes();
    panes[0]?.setStretchFactor(overlays.rsi && overlays.macd ? 0.62 : overlays.rsi || overlays.macd ? 0.74 : 1);

    if (overlays.rsi) {
      const pane = chart.addPane(true);
      pane.setStretchFactor(0.18);
      rsiSeries = chart.addSeries(
        LineSeries,
        {
          color: "#eab308",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "RSI",
        },
        chart.panes().length - 1,
      );
      rsiSeries.createPriceLine({
        price: 70,
        color: "rgba(239,68,68,0.45)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(34,197,94,0.45)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
      });
    }

    if (overlays.macd) {
      const pane = chart.addPane(true);
      pane.setStretchFactor(0.2);
      const paneIndex = chart.panes().length - 1;
      macdHist = chart.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false, title: "MACD" },
        paneIndex,
      );
      macdLine = chart.addSeries(
        LineSeries,
        { color: "#38bdf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: true },
        paneIndex,
      );
      macdSignal = chart.addSeries(
        LineSeries,
        { color: "#f97316", lineWidth: 1, priceLineVisible: false, lastValueVisible: true },
        paneIndex,
      );
    }

    chartRef.current = chart;
    candleSeriesRef.current = mainSeries;
    volumeSeriesRef.current = volumeSeries;
    rsiSeriesRef.current = rsiSeries;
    macdLineRef.current = macdLine;
    macdSignalRef.current = macdSignal;
    macdHistRef.current = macdHist;

    chart.subscribeCrosshairMove((param) => {
      const time = param.time as number | undefined;
      setHovered(time == null ? null : (byTimeRef.current.get(time) ?? null));
    });

    const refreshMapper = () => {
      const series = candleSeriesRef.current;
      const live = chartRef.current;
      if (!series || !live) return;
      setMapper({
        width: container.clientWidth,
        timeToX: (time) => live.timeScale().timeToCoordinate(time as UTCTimestamp),
        priceToY: (price) => series.priceToCoordinate(price),
        xToTime: (x) => {
          const value = live.timeScale().coordinateToTime(x);
          return typeof value === "number" ? value : null;
        },
        yToPrice: (y) => series.coordinateToPrice(y),
      });
    };

    const observer = new ResizeObserver(() => {
      applyContainerSize(chart, container);
      fitTimeScale(chart, barCountRef.current);
      refreshMapper();
    });
    observer.observe(container);
    applyContainerSize(chart, container);

    const onRangeChange = () => refreshMapper();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const blockPageScroll = (event: TouchEvent) => {
      if (event.touches.length >= 1) event.preventDefault();
    };
    container.addEventListener("touchmove", blockPageScroll, { passive: false });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      container.removeEventListener("touchmove", blockPageScroll);
      observer.disconnect();
      overlaySeriesRef.current = [];
      rsiSeriesRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current = null;
      setHovered(null);
      chart.remove();
    };
  }, [overlayKey]);

  useEffect(() => {
    const main = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!main || !volumeSeries || !chart) return;

    const source = displayCandles;
    const byTime = new Map<number, Candle>();
    for (const candle of source) byTime.set(candle.time, candle);
    byTimeRef.current = byTime;
    barCountRef.current = source.length;

    if (chartType === "line") {
      (main as ISeriesApi<"Line">).setData(toLine(source));
    } else {
      (main as ISeriesApi<"Candlestick">).setData(toOhlc(source));
    }
    volumeSeries.setData(toVolume(source));

    for (const line of overlaySeriesRef.current) {
      try {
        chart.removeSeries(line);
      } catch {
        /* series already gone with a pane rebuild */
      }
    }
    overlaySeriesRef.current = [];

    const addOverlay = (points: { time: number; value: number }[], color: string, title: string) => {
      if (points.length === 0) return;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title,
        crosshairMarkerVisible: false,
      });
      series.setData(
        points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })),
      );
      overlaySeriesRef.current.push(series);
    };

    if (overlays.sma20) addOverlay(smaOverlay(candles, 20), SMA_COLORS[20], "SMA 20");
    if (overlays.sma50) addOverlay(smaOverlay(candles, 50), SMA_COLORS[50], "SMA 50");
    if (overlays.sma200) addOverlay(smaOverlay(candles, 200), SMA_COLORS[200], "SMA 200");
    if (overlays.ema) addOverlay(emaOverlay(candles, 20), EMA_COLOR, "EMA 20");

    if (overlays.rsi && rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(
        rsiOverlay(candles).map((point) => ({
          time: point.time as UTCTimestamp,
          value: point.value,
        })),
      );
    }

    if (overlays.macd && macdLineRef.current && macdSignalRef.current && macdHistRef.current) {
      const macd = macdOverlay(candles);
      macdLineRef.current.setData(
        macd.map((point) => ({ time: point.time as UTCTimestamp, value: point.macd })),
      );
      macdSignalRef.current.setData(
        macd.map((point) => ({ time: point.time as UTCTimestamp, value: point.signal })),
      );
      macdHistRef.current.setData(
        macd.map((point) => ({
          time: point.time as UTCTimestamp,
          value: point.histogram,
          color: point.histogram >= 0 ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)",
        })),
      );
    }

    setProfile(overlays.volumeProfile ? volumeProfile(source) : []);
    fitTimeScale(chart, source.length);
  }, [displayCandles, candles, chartType, overlays]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* rebuilt */
      }
    }
    const next: IPriceLine[] = [];
    for (const drawing of drawings) {
      if (drawing.kind === "hline") {
        next.push(
          series.createPriceLine({
            price: drawing.price,
            color: "#c084fc",
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: "S/R",
          }),
        );
      }
      if (drawing.kind === "fib") {
        const high = Math.max(drawing.a.price, drawing.b.price);
        const low = Math.min(drawing.a.price, drawing.b.price);
        const span = high - low;
        for (const level of FIB_LEVELS) {
          next.push(
            series.createPriceLine({
              price: high - span * level,
              color: "rgba(251, 191, 36, 0.85)",
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: `${(level * 100).toFixed(1)}%`,
            }),
          );
        }
      }
    }
    priceLinesRef.current = next;
  }, [drawings, overlayKey]);

  const readPoint = useCallback(
    (event: MouseEvent<HTMLDivElement>): ChartPoint | null => {
      const container = containerRef.current;
      const live = mapper;
      if (!container || !live) return null;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const time = live.xToTime(x);
      const price = live.yToPrice(y);
      if (time == null || price == null) return null;
      return { time, price };
    },
    [mapper],
  );

  function handleDrawMove(event: MouseEvent<HTMLDivElement>) {
    if (drawingTool === "cursor") return;
    setCursor(readPoint(event));
  }

  function handleDrawClick(event: MouseEvent<HTMLDivElement>) {
    if (drawingTool === "cursor") return;
    const point = readPoint(event);
    if (!point) return;

    if (drawingTool === "hline") {
      setDrawings((current) => [...current, { id: newId(), kind: "hline", price: point.price }]);
      onDrawingComplete?.();
      setDraft(null);
      return;
    }

    if (!draft) {
      setDraft(point);
      return;
    }

    setDrawings((current) => [
      ...current,
      {
        id: newId(),
        kind: drawingTool,
        a: draft,
        b: point,
      },
    ]);
    setDraft(null);
    onDrawingComplete?.();
  }

  const readout = hovered ?? displayCandles.at(-1) ?? null;
  const maxProfile = profile.reduce((max, bin) => Math.max(max, bin.volume), 0);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden overscroll-none">
      <div ref={containerRef} className="chart-touch-surface h-full min-h-0 w-full" />

      {drawingTool !== "cursor" ? (
        <div
          className="absolute inset-0 z-20 cursor-crosshair"
          onClick={handleDrawClick}
          onMouseMove={handleDrawMove}
          onMouseLeave={() => setCursor(null)}
        />
      ) : null}

      {mapper ? (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          {drawings.map((drawing) => {
            if (drawing.kind !== "trendline") return null;
            const x1 = mapper.timeToX(drawing.a.time);
            const y1 = mapper.priceToY(drawing.a.price);
            const x2 = mapper.timeToX(drawing.b.time);
            const y2 = mapper.priceToY(drawing.b.price);
            if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
            return (
              <line
                key={drawing.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
            );
          })}
          {draft && cursor && drawingTool !== "hline" ? (
            <line
              x1={mapper.timeToX(draft.time) ?? 0}
              y1={mapper.priceToY(draft.price) ?? 0}
              x2={mapper.timeToX(cursor.time) ?? 0}
              y2={mapper.priceToY(cursor.price) ?? 0}
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          ) : null}
        </svg>
      ) : null}

      {overlays.volumeProfile && mapper && maxProfile > 0 ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-[22%] max-w-[160px]">
          {profile.map((bin) => {
            const y = mapper.priceToY(bin.price);
            if (y == null) return null;
            const width = (bin.volume / maxProfile) * 100;
            return (
              <div
                key={bin.price}
                className="absolute h-1.5 -translate-y-1/2 bg-sky-400/25"
                style={{ top: y, width: `${width}%` }}
              />
            );
          })}
        </div>
      ) : null}

      {readout ? (
        <div className="pointer-events-none absolute left-10 top-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[9px] text-neutral-500 md:left-10">
          <span className="text-neutral-400">{formatKlTime(readout.time * 1000)}</span>
          <span>
            O <span className="text-neutral-200">{formatPrice(readout.open)}</span>
          </span>
          <span>
            H <span className="text-neutral-200">{formatPrice(readout.high)}</span>
          </span>
          <span>
            L <span className="text-neutral-200">{formatPrice(readout.low)}</span>
          </span>
          <span>
            C <span className="text-neutral-200">{formatPrice(readout.close)}</span>
          </span>
          <span className="pointer-events-auto">
            <Jargon term="volume">VOL</Jargon>{" "}
            <span className="text-neutral-200">{formatVolume(readout.volume)}</span>
          </span>
        </div>
      ) : null}

      {drawings.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setDrawings([]);
            setDraft(null);
          }}
          className="absolute bottom-6 left-10 z-30 border border-line bg-[#121212]/90 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-neutral-500 hover:text-loss"
        >
          Clear drawings
        </button>
      ) : null}
    </div>
  );
}
