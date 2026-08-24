/**
 * Plain-English definitions for the metrics on screen. Written for someone
 * opening their first trading account, so no term is explained with another
 * piece of jargon.
 */

export type JargonTerm =
  | "pe"
  | "marketCap"
  | "dividendYield"
  | "opr"
  | "volume"
  | "week52"
  | "cpi"
  | "klci"
  | "shariah";

export const JARGON: Record<JargonTerm, { title: string; body: string }> = {
  pe: {
    title: "P/E Ratio",
    body: "Price-to-Earnings Ratio. Tells you how expensive a stock is compared to the profit the company actually makes. A P/E of 15 means you pay RM15 for every RM1 of yearly profit per share.",
  },
  marketCap: {
    title: "Market Cap",
    body: "The total value of all the company's outstanding shares — share price multiplied by the number of shares in issue. It is what the market thinks the whole company is worth.",
  },
  dividendYield: {
    title: "Dividend Yield",
    body: "The annual cash payout you receive per share, expressed as a percentage of the stock price. A 5% yield means RM100 invested has recently paid about RM5 a year in cash.",
  },
  opr: {
    title: "Overnight Policy Rate",
    body: "The benchmark interest rate Bank Negara Malaysia sets. It steers what banks charge on loans and pay on deposits, so it moves borrowing costs across the whole market.",
  },
  volume: {
    title: "Volume",
    body: "How many shares changed hands in the period. Heavy volume means plenty of buyers and sellers, so a price move carries more conviction and it is easier to get in or out.",
  },
  week52: {
    title: "52-week range",
    body: "The lowest and highest price the stock traded at over the past year. The marker shows where the current price sits between those two extremes.",
  },
  cpi: {
    title: "CPI inflation",
    body: "The Consumer Price Index measures how much the typical basket of household spending costs compared with a year ago. It is the headline measure of how fast prices are rising.",
  },
  klci: {
    title: "FBM KLCI",
    body: "The FTSE Bursa Malaysia KLCI tracks the 30 largest companies on the exchange. It is the usual shorthand for how the Malaysian market as a whole is doing.",
  },
  shariah: {
    title: "Shariah compliant",
    body: "The Securities Commission screens listed companies against Islamic principles, excluding conventional banking and insurance, gambling, alcohol, tobacco and adult entertainment, plus companies carrying too much interest-based debt.",
  },
};
