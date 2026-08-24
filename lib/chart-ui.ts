export type ChartOverlays = {
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema: boolean;
  volumeProfile: boolean;
  rsi: boolean;
  macd: boolean;
};

export type DrawingTool = "cursor" | "trendline" | "hline" | "fib";

export const EMPTY_OVERLAYS: ChartOverlays = {
  sma20: false,
  sma50: false,
  sma200: false,
  ema: false,
  volumeProfile: false,
  rsi: false,
  macd: false,
};
