/** European Black-Scholes warrant pricer and first-order Greeks — client-safe. */

export type WarrantType = "call" | "put";

export type BlackScholesInputs = {
  spot: number;
  strike: number;
  timeYears: number;
  volatility: number;
  rate: number;
  type: WarrantType;
};

export type BlackScholesResult = {
  price: number;
  intrinsic: number;
  timeValue: number;
  d1: number;
  d2: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  moneyness: number;
};

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Abramowitz & Stegun 7.1.26 error function. */
function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * abs);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-abs * abs);
  return sign * y;
}

export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

function intrinsicValue(spot: number, strike: number, type: WarrantType): number {
  if (type === "call") return Math.max(0, spot - strike);
  return Math.max(0, strike - spot);
}

export function blackScholes(inputs: BlackScholesInputs): BlackScholesResult {
  const { spot, strike, timeYears, volatility, rate, type } = inputs;
  const intrinsic = intrinsicValue(spot, strike, type);
  const moneyness = strike > 0 ? spot / strike : 0;

  if (!(spot > 0) || !(strike > 0) || !Number.isFinite(spot) || !Number.isFinite(strike)) {
    return {
      price: 0,
      intrinsic: 0,
      timeValue: 0,
      d1: 0,
      d2: 0,
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      moneyness,
    };
  }

  if (timeYears <= 0 || volatility <= 0) {
    return {
      price: intrinsic,
      intrinsic,
      timeValue: 0,
      d1: 0,
      d2: 0,
      delta: type === "call" ? (spot >= strike ? 1 : 0) : spot <= strike ? -1 : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      moneyness,
    };
  }

  const sqrtT = Math.sqrt(timeYears);
  const sigmaSqrtT = volatility * sqrtT;
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * volatility * volatility) * timeYears) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;
  const discount = Math.exp(-rate * timeYears);
  const nd1 = normCdf(d1);
  const nd2 = normCdf(d2);
  const pdf = normPdf(d1);

  const call = spot * nd1 - strike * discount * nd2;
  const put = strike * discount * normCdf(-d2) - spot * normCdf(-d1);
  const price = type === "call" ? call : put;

  const gamma = pdf / (spot * sigmaSqrtT);
  const vega = (spot * pdf * sqrtT) / 100;
  const thetaCall =
    (-spot * pdf * volatility) / (2 * sqrtT) - rate * strike * discount * nd2;
  const thetaPut =
    (-spot * pdf * volatility) / (2 * sqrtT) + rate * strike * discount * normCdf(-d2);

  return {
    price: Math.max(0, price),
    intrinsic,
    timeValue: Math.max(0, price - intrinsic),
    d1,
    d2,
    delta: type === "call" ? nd1 : nd1 - 1,
    gamma,
    theta: (type === "call" ? thetaCall : thetaPut) / 365,
    vega,
    moneyness,
  };
}

export function priceCurve(
  inputs: BlackScholesInputs,
  points = 41,
): Array<{ spot: number; theoretical: number; intrinsic: number }> {
  const lo = Math.max(0.01, inputs.strike * 0.5);
  const hi = Math.max(lo * 1.01, inputs.strike * 1.5);
  const step = (hi - lo) / (points - 1);
  return Array.from({ length: points }, (_, index) => {
    const spot = lo + index * step;
    const priced = blackScholes({ ...inputs, spot });
    return {
      spot,
      theoretical: priced.price,
      intrinsic: priced.intrinsic,
    };
  });
}
