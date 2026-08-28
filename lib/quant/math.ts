/** Pure quant utilities — safe for client and server. */

const klDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Minimum aligned trading days required before Pearson r is computed. */
export const MIN_CORRELATION_SAMPLES = 60;

export function normalizeTradingDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = Date.parse(`${date}T12:00:00+08:00`);
  if (Number.isNaN(parsed)) return date;
  return klDateFormatter.format(new Date(parsed));
}

export function unixToDate(unixSeconds: number): string {
  return klDateFormatter.format(new Date(unixSeconds * 1000));
}

export function klIsoDate(date: Date = new Date()): string {
  return klDateFormatter.format(date);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export function isoDate(date: Date): string {
  return klIsoDate(date);
}

/** Calendar days fetched so ~90 Bursa sessions survive holidays/weekends after alignment. */
export function calendarDaysForTradingWindow(tradingDays: number): number {
  return Math.max(150, Math.ceil(tradingDays * (7 / 5)) + 35);
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;

  const n = xs.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function dailyReturns(
  closes: Array<{ time: number; close: number }>,
): Map<string, number> {
  const returns = new Map<string, number>();

  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1]?.close;
    const current = closes[index]?.close;
    if (previous == null || current == null || previous === 0) continue;
    const date = normalizeTradingDate(unixToDate(closes[index].time));
    returns.set(date, (current - previous) / previous);
  }

  return returns;
}

export function closesByDate(
  closes: Array<{ time: number; close: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of closes) {
    map.set(normalizeTradingDate(unixToDate(row.time)), row.close);
  }
  return map;
}

export function alignSeries(
  factorByDate: Map<string, number>,
  priceByDate: Map<string, number>,
): { dates: string[]; factor: number[]; price: number[] } {
  const dates = [...factorByDate.keys()]
    .filter((date) => priceByDate.has(date))
    .sort();

  return {
    dates,
    factor: dates.map((date) => factorByDate.get(date)!),
    price: dates.map((date) => priceByDate.get(date)!),
  };
}

export function alignReturns(
  factorByDate: Map<string, number>,
  returnsByDate: Map<string, number>,
): { dates: string[]; factor: number[]; returns: number[] } {
  const normalizedFactor = new Map<string, number>();
  for (const [date, value] of factorByDate) {
    normalizedFactor.set(normalizeTradingDate(date), value);
  }

  const normalizedReturns = new Map<string, number>();
  for (const [date, value] of returnsByDate) {
    normalizedReturns.set(normalizeTradingDate(date), value);
  }

  const dates = [...normalizedReturns.keys()]
    .filter((date) => normalizedFactor.has(date))
    .sort();

  return {
    dates,
    factor: dates.map((date) => normalizedFactor.get(date)!),
    returns: dates.map((date) => normalizedReturns.get(date)!),
  };
}

export function rollingPearsonOnMaps(
  factorByDate: Map<string, number>,
  returnsByDate: Map<string, number>,
  window: number,
  minSamples = MIN_CORRELATION_SAMPLES,
): number | null {
  const aligned = alignReturns(factorByDate, returnsByDate);
  const available = aligned.dates.length;
  if (available < minSamples) return null;

  const effectiveWindow = Math.min(window, available);
  if (effectiveWindow < 3) return null;

  return pearsonCorrelation(
    aligned.factor.slice(-effectiveWindow),
    aligned.returns.slice(-effectiveWindow),
  );
}

export function scaleToScore(value: number, sensitivity = 1): number {
  const clamped = Math.max(-3, Math.min(3, value * sensitivity));
  return Math.round(Math.tanh(clamped) * 100);
}

export function scoreFromCorrelation(r: number | null): number {
  if (r == null) return 0;
  return scaleToScore(r, 1.2);
}

export function momentumPct(closes: Array<{ time: number; close: number }>, days: number): number | null {
  if (closes.length < days + 1) return null;
  const latest = closes[closes.length - 1]?.close;
  const base = closes[closes.length - 1 - days]?.close;
  if (latest == null || base == null || base === 0) return null;
  return ((latest - base) / base) * 100;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

export function zScoreLatest(values: number[]): number | null {
  if (values.length < 5) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (values[values.length - 1] - mean) / std;
}

export function pctAboveMovingAverage(
  closes: Array<{ time: number; close: number }>,
  period: number,
): number | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const average = window.reduce((sum, row) => sum + row.close, 0) / period;
  const latest = closes[closes.length - 1]?.close;
  if (latest == null || average === 0) return null;
  return latest >= average ? 100 : 0;
}

export function lastNDates(days: number): string[] {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    dates.push(klIsoDate(daysAgo(offset)));
  }
  return dates;
}
