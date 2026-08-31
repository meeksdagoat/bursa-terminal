import type { BacktestMetrics, BacktestTradeDirection, BacktestTradeRecord } from "@/lib/quant/backtest";

export type DirectionalTradeStats = {
  totalTrades: number;
  winRatePct: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgHoldBars: number;
};

export type BacktestTradeAnalytics = {
  long: DirectionalTradeStats;
  short: DirectionalTradeStats;
  combined: DirectionalTradeStats;
  longShortRatioLabel: string;
  maxDrawdownPct: number;
  payoffRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  recentTrades: BacktestTradeRecord[];
};

const EMPTY_DIRECTIONAL: DirectionalTradeStats = {
  totalTrades: 0,
  winRatePct: 0,
  grossProfit: 0,
  grossLoss: 0,
  profitFactor: 0,
  avgHoldBars: 0,
};

function summarizeDirection(trades: BacktestTradeRecord[]): DirectionalTradeStats {
  if (trades.length === 0) return EMPTY_DIRECTIONAL;

  const wins = trades.filter((trade) => trade.pnlDollar > 0);
  const losses = trades.filter((trade) => trade.pnlDollar < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnlDollar, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnlDollar, 0));
  const avgHoldBars =
    trades.reduce((sum, trade) => sum + trade.holdBars, 0) / Math.max(1, trades.length);

  return {
    totalTrades: trades.length,
    winRatePct: (wins.length / trades.length) * 100,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
    avgHoldBars,
  };
}

function maxConsecutive(trades: BacktestTradeRecord[], wins: boolean): number {
  let best = 0;
  let streak = 0;
  for (const trade of trades) {
    const isWin = trade.pnlDollar > 0;
    if (isWin === wins) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return best;
}

function payoffRatio(trades: BacktestTradeRecord[]): number {
  const wins = trades.filter((trade) => trade.pnlDollar > 0);
  const losses = trades.filter((trade) => trade.pnlDollar < 0);
  if (wins.length === 0 || losses.length === 0) return 0;
  const avgWin = wins.reduce((sum, trade) => sum + trade.pnlDollar, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnlDollar, 0) / losses.length);
  return avgLoss > 0 ? avgWin / avgLoss : 0;
}

export function analyzeBacktestTrades(
  trades: BacktestTradeRecord[],
  metrics: BacktestMetrics,
  recentLimit = 20,
): BacktestTradeAnalytics {
  const longTrades = trades.filter((trade) => trade.direction === "LONG");
  const shortTrades = trades.filter((trade) => trade.direction === "SHORT");
  const combined = summarizeDirection(trades);
  const long = summarizeDirection(longTrades);
  const short = summarizeDirection(shortTrades);
  const totalDirectional = long.totalTrades + short.totalTrades;
  const longPct = totalDirectional > 0 ? (long.totalTrades / totalDirectional) * 100 : 100;
  const shortPct = totalDirectional > 0 ? (short.totalTrades / totalDirectional) * 100 : 0;

  return {
    long,
    short,
    combined,
    longShortRatioLabel: `${longPct.toFixed(0)}% Long / ${shortPct.toFixed(0)}% Short`,
    maxDrawdownPct: metrics.maxDrawdownPct,
    payoffRatio: payoffRatio(trades),
    maxConsecutiveWins: maxConsecutive(trades, true),
    maxConsecutiveLosses: maxConsecutive(trades, false),
    recentTrades: [...trades].slice(-recentLimit).reverse(),
  };
}

export function formatTradeDirection(direction: BacktestTradeDirection): string {
  return direction;
}
