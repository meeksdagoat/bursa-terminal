import type { BacktestEquityPoint, BacktestResult, BacktestTradeRecord } from "@/lib/quant/backtest";
import type { DCASimulatorPayload, DCASimulatorPoint } from "@/lib/quant/dca-simulator";
import { pearsonCorrelation } from "@/lib/quant/math";
import type { MonteCarloSimulationResult } from "@/lib/quant/monte-carlo";
import type { QuantCorrelationPayload, QuantFactorId, QuantFactorSignal } from "@/lib/quant/types";
import {
  addCalendarDaysIso,
  exportFilenameStem,
  todayIsoDate,
  toIsoDateString,
  type ExportPayload,
  type ExportRecord,
  type ExportTable,
} from "@/utils/exportData";

export function maxDrawdownPct(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0]!;
  let maxDd = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    peak = Math.max(peak, value);
    if (peak > 0) {
      maxDd = Math.min(maxDd, ((value - peak) / peak) * 100);
    }
  }
  return maxDd;
}

function sliceEquity(curve: BacktestEquityPoint[], fromDate: string, toDate: string): number[] {
  const start = toIsoDateString(fromDate);
  const end = toIsoDateString(toDate);
  return curve
    .filter((point) => {
      const date = toIsoDateString(point.date);
      return date >= start && date <= end;
    })
    .map((point) => point.strategy);
}

export function buildMonteCarloExport(input: {
  symbol: string;
  horizonDays: number;
  simulation: MonteCarloSimulationResult;
}): ExportPayload {
  const { symbol, horizonDays, simulation } = input;
  const origin = todayIsoDate();
  const maxDd = maxDrawdownPct(simulation.percentilePaths.p50);

  const table: ExportTable = {
    columns: [
      { key: "day", header: "Day" },
      { key: "date", header: "Date" },
      { key: "p90Bull", header: "90th Bull" },
      { key: "p50Median", header: "50th Median" },
      { key: "p10Bear", header: "10th Bear/VaR" },
      { key: "expectedPrice", header: "Expected Price" },
      { key: "maxDrawdownPct", header: "Max Drawdown %" },
    ],
    records: simulation.chartRows.map((row) => ({
      day: row.day,
      date: addCalendarDaysIso(origin, row.day),
      p90Bull: row.p90,
      p50Median: row.p50,
      p10Bear: row.p10,
      expectedPrice: simulation.stats.meanPrice,
      maxDrawdownPct: maxDd,
    })),
  };

  return {
    filename: exportFilenameStem(`monte-carlo-${symbol}-${horizonDays}d`),
    table,
  };
}

export type DcaLedgerRow = {
  date: string;
  investmentAmount: number;
  unitPrice: number;
  unitsPurchased: number;
  cumulativeInvested: number;
  portfolioValue: number;
  unrealizedPnl: number;
};

export function dcaContributionLedger(points: readonly DCASimulatorPoint[]): DcaLedgerRow[] {
  return points
    .filter((point) => point.investmentAmount > 0)
    .map((point) => ({
      date: toIsoDateString(point.timestamp),
      investmentAmount: point.investmentAmount,
      unitPrice: point.unitPrice,
      unitsPurchased: point.unitsPurchased,
      cumulativeInvested: point.cumulativeInvested,
      portfolioValue: point.portfolioValue,
      unrealizedPnl: point.unrealizedPnl,
    }));
}

export function buildDcaExport(payload: DCASimulatorPayload): ExportPayload {
  const records: ExportRecord[] = dcaContributionLedger(payload.points).map((row) => ({
    date: row.date,
    investmentAmount: row.investmentAmount,
    unitPrice: row.unitPrice,
    unitsPurchased: row.unitsPurchased,
    cumulativeInvested: row.cumulativeInvested,
    portfolioValue: row.portfolioValue,
    unrealizedPnl: row.unrealizedPnl,
  }));

  return {
    filename: exportFilenameStem(`dca-${payload.symbol}-${payload.frequency}-${payload.period}`),
    table: {
      columns: [
        { key: "date", header: "Date" },
        { key: "investmentAmount", header: "Investment Amount" },
        { key: "unitPrice", header: "Unit Price" },
        { key: "unitsPurchased", header: "Units Purchased" },
        { key: "cumulativeInvested", header: "Cumulative Invested" },
        { key: "portfolioValue", header: "Portfolio Value" },
        { key: "unrealizedPnl", header: "Unrealized PnL" },
      ],
      records,
    },
  };
}

function signalTypeForTrade(trade: BacktestTradeRecord): "Buy" | "Sell" {
  return trade.direction === "SHORT" ? "Sell" : "Buy";
}

export function buildBacktestExport(input: {
  symbol: string;
  result: BacktestResult;
}): ExportPayload {
  const { symbol, result } = input;
  const records: ExportRecord[] = result.trades.map((trade) => {
    const path = sliceEquity(result.equityCurve, trade.entryDate, trade.exitDate);
    return {
      entryDate: toIsoDateString(trade.entryDate),
      exitDate: toIsoDateString(trade.exitDate),
      signalType: signalTypeForTrade(trade),
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      returnPct: trade.pnlPct,
      drawdown: maxDrawdownPct(path.length > 0 ? path : [trade.entryEquity, trade.entryEquity + trade.pnlDollar]),
    };
  });

  return {
    filename: exportFilenameStem(`backtest-trades-${symbol}`),
    table: {
      columns: [
        { key: "entryDate", header: "Entry Date" },
        { key: "exitDate", header: "Exit Date" },
        { key: "signalType", header: "Signal Type (Buy/Sell)" },
        { key: "entryPrice", header: "Entry Price" },
        { key: "exitPrice", header: "Exit Price" },
        { key: "returnPct", header: "Return %" },
        { key: "drawdown", header: "Drawdown" },
      ],
      records,
    },
  };
}

export type WeatherDailyPoint = {
  date: string;
  precipitationMm: number;
  temperatureC: number;
};

function rollingPearsonSeries(
  factor: number[],
  returns: number[],
  window = 30,
  minSamples = 10,
): Array<number | null> {
  return factor.map((_, index) => {
    const start = index - window + 1;
    if (start < 0) return null;
    const xs = factor.slice(start, index + 1);
    const ys = returns.slice(start, index + 1);
    if (xs.length < minSamples) return null;
    return pearsonCorrelation(xs, ys);
  });
}

export function buildWeatherAltDataExport(input: {
  symbol: string;
  weather: WeatherDailyPoint[];
  correlation: QuantCorrelationPayload | null;
}): ExportPayload {
  const { symbol, weather, correlation } = input;
  const weatherByDate = new Map(weather.map((row) => [toIsoDateString(row.date), row]));
  const priceByDate = new Map<string, number>();

  for (const point of correlation?.points ?? []) {
    if (point.price == null || !Number.isFinite(point.price)) continue;
    priceByDate.set(toIsoDateString(point.date), point.price);
  }

  const dates = [...new Set([...weatherByDate.keys(), ...priceByDate.keys()])]
    .filter((date) => date.length > 0)
    .sort();

  const alignedFactor: number[] = [];
  const alignedReturns: number[] = [];
  const alignedDates: string[] = [];
  let previousPrice: number | null = null;

  for (const date of dates) {
    const precip = weatherByDate.get(date)?.precipitationMm;
    const price = priceByDate.get(date);
    if (precip == null || price == null || previousPrice == null || previousPrice === 0) {
      if (price != null) previousPrice = price;
      continue;
    }
    alignedDates.push(date);
    alignedFactor.push(precip);
    alignedReturns.push((price - previousPrice) / previousPrice);
    previousPrice = price;
  }

  const rolling = rollingPearsonSeries(alignedFactor, alignedReturns);
  const rollingByDate = new Map(alignedDates.map((date, index) => [date, rolling[index] ?? null]));

  const records: ExportRecord[] = dates
    .filter((date) => weatherByDate.has(date) || priceByDate.has(date))
    .map((date) => {
      const row = weatherByDate.get(date);
      return {
        date,
        precipitationMm: row?.precipitationMm ?? null,
        temperatureC: row?.temperatureC ?? null,
        targetSymbolPrice: priceByDate.get(date) ?? null,
        rollingPearsonR30: rollingByDate.get(date) ?? null,
      };
    });

  return {
    filename: exportFilenameStem(`weather-alt-data-${symbol}`),
    table: {
      columns: [
        { key: "date", header: "Date" },
        { key: "precipitationMm", header: "Precipitation (mm)" },
        { key: "temperatureC", header: "Temperature (°C)" },
        { key: "targetSymbolPrice", header: "Target Symbol Price" },
        { key: "rollingPearsonR30", header: "Rolling 30-Day Pearson r" },
      ],
      records,
    },
  };
}

const FACTOR_EXPORT_COLUMNS: readonly {
  id: QuantFactorId;
  key: string;
  header: string;
}[] = [
  { id: "weather-agri", key: "factor1Weather", header: "Factor 1 (Weather)" },
  { id: "institutional-divergence", key: "factor2InstFlow", header: "Factor 2 (Inst. Flow)" },
  { id: "news-velocity", key: "factor3NewsVelocity", header: "Factor 3 (News Velocity)" },
  { id: "fx-beta", key: "factor4FxBeta", header: "Factor 4 (FX Beta)" },
  { id: "yield-spread", key: "factor5YieldSpread", header: "Factor 5 (Yield Spread)" },
  { id: "sector-breadth", key: "factor6MarketBreadth", header: "Factor 6 (Market Breadth)" },
];

function displayFactorScore(factor: QuantFactorSignal | undefined): number {
  if (!factor) return 0;
  if (factor.metadata.sectorMuted != null) return 0;
  return factor.score;
}

export function buildFactorMatrixExport(input: {
  symbol: string;
  factors: QuantFactorSignal[];
}): ExportPayload {
  const byId = new Map(input.factors.map((factor) => [factor.id, factor]));
  const scores = FACTOR_EXPORT_COLUMNS.map((column) => displayFactorScore(byId.get(column.id)));
  const compositeScore =
    scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;

  const record: ExportRecord = {
    symbol: input.symbol,
    compositeScore,
  };
  for (let index = 0; index < FACTOR_EXPORT_COLUMNS.length; index += 1) {
    record[FACTOR_EXPORT_COLUMNS[index]!.key] = scores[index] ?? 0;
  }

  return {
    filename: exportFilenameStem(`factor-matrix-${input.symbol}`),
    table: {
      columns: [
        { key: "symbol", header: "Symbol" },
        ...FACTOR_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
        { key: "compositeScore", header: "Composite Score" },
      ],
      records: [record],
    },
  };
}
