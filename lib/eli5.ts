/**
 * Plain-English explainers for headlines, DOSM prints and Bursa filings.
 *
 * News items never use shared filler ("this is a news item…"). If the article
 * body is missing, the explainer restates that headline plus any ticker
 * context; if even that cannot be done, the UI hides the card.
 */

import type { DosmStat, FilingCategory } from "./types";
import { mentionedCompanies } from "./universe";

export type Eli5Sentiment = "positive" | "neutral" | "caution";

export type Eli5Summary = {
  /** "What happened", in beginner language. */
  happened: string;
  /** "Why it matters for shareholders". */
  matters: string;
  sentiment: Eli5Sentiment;
};

const POSITIVE_WORDS = [
  "jump",
  "jumps",
  "surge",
  "surges",
  "rise",
  "rises",
  "rose",
  "gain",
  "gains",
  "higher",
  "record",
  "beat",
  "beats",
  "upgrade",
  "upgrades",
  "win",
  "wins",
  "won",
  "awarded",
  "secures",
  "expand",
  "expands",
  "growth",
  "rebound",
  "strengthen",
  "strengthens",
  "approval",
  "approved",
  "profit",
  "dividend",
  "boost",
  "improve",
  "improves",
  "recovery",
];

const CAUTION_WORDS = [
  "fall",
  "falls",
  "fell",
  "drop",
  "drops",
  "slump",
  "slumps",
  "decline",
  "declines",
  "loss",
  "losses",
  "cut",
  "cuts",
  "downgrade",
  "downgrades",
  "probe",
  "fine",
  "fined",
  "lawsuit",
  "suit",
  "investigation",
  "suspend",
  "suspended",
  "halt",
  "halted",
  "resign",
  "resigns",
  "warning",
  "warns",
  "miss",
  "misses",
  "weak",
  "weaker",
  "delay",
  "delays",
  "default",
  "risk",
  "risks",
  "concern",
  "concerns",
  "plunge",
  "plunges",
  "slower",
  "burden",
  "deficit",
];

function words(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9']+/).filter((word) => word.length > 0);
}

function scoreSentiment(title: string): Eli5Sentiment {
  const tokens = new Set(words(title));
  let positive = 0;
  let caution = 0;

  for (const word of POSITIVE_WORDS) if (tokens.has(word)) positive += 1;
  for (const word of CAUTION_WORDS) if (tokens.has(word)) caution += 1;

  if (positive > caution) return "positive";
  if (caution > positive) return "caution";
  return "neutral";
}

const PLACEHOLDER_PATTERNS = [
  /this is a news item/i,
  /is in the news, but the headline is not/i,
  /treat it as background/i,
  /this is an official malaysian statistics/i,
  /a government policy, tax or budget decision is in play/i,
  /this is about the interest rate bank negara/i,
  /this is a broad market story/i,
  /commodity prices are the story here/i,
  /the headline is not about a specific corporate event/i,
  /no article body was available/i,
  /only confirmed fact is this headline/i,
];

export function isPlaceholderSummary(summary: Pick<Eli5Summary, "happened" | "matters">): boolean {
  const blob = `${summary.happened} ${summary.matters}`;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(blob));
}

/** RSS/Yahoo blurb or generated summary that is real copy, not a headline echo. */
export type SummaryCheckItem = {
  summary?: string | null;
  snippet?: string | null;
  title?: string | null;
  headline?: string | null;
};

export function hasValidSummary(newsItem: SummaryCheckItem): boolean {
  const summary = (newsItem.summary ?? newsItem.snippet ?? "").replace(/\s+/g, " ").trim();
  if (!summary) return false;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(summary))) return false;
  const title = (newsItem.title ?? newsItem.headline ?? "").replace(/\s+/g, " ").trim();
  if (title && summary.toLowerCase() === title.toLowerCase()) return false;
  return true;
}

export type HeadlineContext = {
  snippet?: string | null;
  company?: string | null;
  symbol?: string | null;
};

function namedSubject(title: string, extra?: HeadlineContext): { name: string | null; symbol: string | null } {
  const [company] = mentionedCompanies(title);
  return {
    name: extra?.company?.trim() || company?.name || null,
    symbol: extra?.symbol?.trim() || company?.symbol || null,
  };
}

function ensureSentence(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?…]"?$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clipSentences(value: string, max = 2): string {
  const parts = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((part) => part.length > 0);
  return parts.slice(0, max).join(" ");
}

const SNIPPET_JUNK =
  /full coverage|google news|view full article|subscribe to continue|sign in to read|for subscribers/i;

/** RSS / scrape text that is real article copy, not chrome or a paywall wall. */
export function usableArticleText(text: string | null | undefined, title?: string): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 60) return null;
  if (SNIPPET_JUNK.test(cleaned)) return null;
  if (title) {
    const head = title.replace(/\s+/g, " ").trim().toLowerCase();
    const body = cleaned.toLowerCase();
    if (head.length > 20 && body === head) return null;
    if (head.length > 20 && body.startsWith(head) && cleaned.length < title.length + 50) return null;
  }
  return cleaned;
}

function contextSentence(title: string, name: string | null, symbol: string | null): string {
  if (name && symbol) {
    return `${name} (${symbol}) is the Bursa name this headline points at. No extra figures are assumed beyond the title.`;
  }
  if (name) {
    return `${name} is named in this headline, so any follow-through would show up there first. No extra figures are assumed beyond the title.`;
  }
  return `No article body was available, so the only confirmed fact is this headline: “${title.length > 140 ? `${title.slice(0, 137)}…` : title}”.`;
}

/**
 * Two sentences strictly from the headline, optional snippet, and ticker.
 * Returns null when there is not enough unique material — callers hide the card.
 */
export function summariseHeadline(title: string, extra?: HeadlineContext): Eli5Summary | null {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (cleaned.length < 16) return null;

  const { name, symbol } = namedSubject(cleaned, extra);
  const snippet = usableArticleText(extra?.snippet, cleaned);
  const happened = snippet ? clipSentences(snippet, 2) : ensureSentence(cleaned);
  const matters = contextSentence(cleaned, name, symbol);

  if (!happened || happened.length < 16) return null;
  const summary = { happened, matters, sentiment: scoreSentiment(cleaned) };
  return isPlaceholderSummary(summary) ? null : summary;
}

export function summariseDosmStat(stat: DosmStat): Eli5Summary {
  const loaded = stat.display !== "—" && stat.value != null;
  const period = stat.hint && stat.hint !== "DOSM" ? ` (${stat.hint})` : "";
  const signed = loaded ? (stat.value as number) : null;
  const tone = (value: number | null): Eli5Sentiment => {
    if (value == null) return "neutral";
    if (value > 0) return "positive";
    if (value < 0) return "caution";
    return "neutral";
  };

  switch (stat.id) {
    case "gdp":
      return {
        happened: loaded
          ? `Malaysia's real GDP was ${stat.display} year-on-year${period}. GDP is the total value of goods and services produced in the country.`
          : "This is DOSM's GDP growth print: how fast Malaysia's economy expanded versus a year earlier.",
        matters:
          "Faster growth usually supports company sales and jobs. A surprise versus forecasts is what tends to move the ringgit, banks and the KLCI the next session.",
        sentiment: tone(signed),
      };
    case "unemployment":
      return {
        happened: loaded
          ? `${stat.display} of the labour force was unemployed${period}. That is the share of people who want a job but do not have one.`
          : "This is the unemployment rate: the share of people who want a job but do not have one.",
        matters:
          "A low jobless rate means households have income to spend, which supports retailers and banks. It can also keep Bank Negara cautious about cutting the OPR.",
        sentiment: stat.hint.includes("10-yr") ? "positive" : "neutral",
      };
    case "trade":
      return {
        happened: loaded
          ? `Malaysia ran a goods trade balance of ${stat.display}${period}: exports minus imports.`
          : "This is the goods trade balance: exports minus imports.",
        matters:
          "A surplus brings foreign currency into the country and typically supports the ringgit. Export-heavy names — tech, planters, energy — feel it first.",
        sentiment: tone(signed),
      };
    case "ipi":
      return {
        happened: loaded
          ? `Factories and mines produced ${stat.display} versus a year earlier${period}. The industrial production index tracks output, not prices.`
          : "This is the industrial production index: whether factories, mines and utilities produced more or less than a year ago.",
        matters:
          "Rising output is a leading read on manufacturing earnings and on next quarter's GDP. Weak IPI often shows up in gloves, tech and energy names first.",
        sentiment: tone(signed),
      };
  }
}

export function summariseMacroEvent(event: {
  title: string;
  source: string;
  when: string;
}): Eli5Summary {
  const hay = event.title.toLowerCase();
  const when = event.when;

  if (hay.includes("opr")) {
    return {
      happened: `Bank Negara's next Overnight Policy Rate decision is due ${when}. The committee either holds, hikes or cuts the policy rate.`,
      matters:
        "The OPR sets borrowing costs across the economy. A hold is usually already priced in; a surprise cut helps property and consumers, while a hike helps bank net interest margins.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("fomc") || hay.includes("federal open market")) {
    return {
      happened: `The Federal Reserve's FOMC announces its next rate decision ${when}. The committee either holds, hikes or cuts the federal funds target.`,
      matters:
        "US rates set the global cost of dollars. A surprise cut usually lifts equities and gold; a hawkish hold or hike lifts the dollar and Treasury yields, which can weigh on the ringgit.",
      sentiment: "neutral",
    };
  }
  if (
    hay.includes("cpi") &&
    (event.source === "BLS" || hay.includes("united states") || hay.includes("us "))
  ) {
    return {
      happened: `The US Bureau of Labor Statistics publishes CPI ${when}. That is the official American inflation rate.`,
      matters:
        "US inflation is the main input into the Fed path. A hotter print typically lifts Treasury yields and the dollar; a cooler print does the opposite and often helps risk assets.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("ecb")) {
    return {
      happened: `The European Central Bank announces its next policy decision ${when}, including the deposit facility rate.`,
      matters:
        "ECB moves reprice the euro, European banks and global bond yields. A surprise cut usually weakens the euro versus the dollar and can spill into Asian FX.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("boj")) {
    return {
      happened: `The Bank of Japan announces its policy rate ${when}. Japan is the last major economy still near zero.`,
      matters:
        "BOJ surprises move the yen and the global carry trade. A hike that is faster than expected typically lifts the yen and can tighten financial conditions worldwide.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("pboc") || hay.includes("loan prime")) {
    return {
      happened: `The People's Bank of China publishes the loan prime rate ${when}. That is China's benchmark lending rate.`,
      matters:
        "LPR cuts are a signal that Beijing wants cheaper credit. They usually support China-sensitive commodities, Malaysian planters and regional risk appetite.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("cpi")) {
    return {
      happened: `DOSM publishes the consumer price index ${when}. CPI is the official inflation rate households feel in shops.`,
      matters:
        "Inflation is the main input into the OPR decision. A hotter print makes a rate cut less likely and can weigh on rate-sensitive stocks.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("budget")) {
    return {
      happened: `The Finance Ministry tables the federal budget ${when}. That is the government's tax and spending plan for the year ahead.`,
      matters:
        "Budget night resets subsidies, SST, development spending and GLC dividends. Construction, utilities and consumer names usually move first.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("trade")) {
    return {
      happened: `DOSM releases the external trade figures ${when}: exports, imports and the surplus or deficit.`,
      matters:
        "Trade is a large slice of Malaysian GDP. A stronger surplus supports the ringgit and export stocks; a miss does the opposite.",
      sentiment: "neutral",
    };
  }
  if (hay.includes("gdp")) {
    return {
      happened: `DOSM's next GDP print is due ${when}. That is the official score for how fast the whole economy grew.`,
      matters:
        "GDP surprises reset growth forecasts and often the KLCI on the day. Banks, construction and consumer names are the most sensitive.",
      sentiment: "neutral",
    };
  }

  return {
    happened: `${event.source} has a scheduled release: ${event.title}, due ${when}.`,
    matters:
      "Scheduled prints can move the ringgit and the KLCI on the day they land, even when the number is close to forecast.",
    sentiment: "neutral",
  };
}

/** Filing titles follow Bursa's own naming, e.g. "... - EMPLOYEES PROVIDENT FUND BOARD". */
function filingParty(title: string): string | null {
  const parts = title.split(" - ").map((part) => part.trim());
  const last = parts.length > 1 ? parts[parts.length - 1] : null;
  if (!last || last.length < 4 || last.length > 70) return null;
  return last.replace(/\s+/g, " ");
}

const FILING_TEXT: Record<
  FilingCategory,
  { happened: (party: string | null) => string; matters: string; sentiment: Eli5Sentiment }
> = {
  QR: {
    happened: () =>
      "The company filed its scheduled financial report with Bursa Malaysia — the official numbers for the period.",
    matters:
      "This is the company's scorecard. Revenue, profit and any dividend for the period are confirmed here rather than estimated.",
    sentiment: "neutral",
  },
  IA: {
    happened: (party) =>
      party
        ? `A large shareholder — ${party} — changed the size of its stake in the company.`
        : "A large shareholder changed the size of its stake in the company.",
    matters:
      "Funds like EPF and KWAP move big blocks of shares. Them buying is often read as confidence; steady selling can weigh on the share price.",
    sentiment: "neutral",
  },
  DIV: {
    happened: () => "The company set out a dividend or entitlement timetable.",
    matters:
      "It tells you the cash per share and the date by which you must already own the stock in order to qualify for the payment.",
    sentiment: "positive",
  },
  BOARD: {
    happened: (party) =>
      party
        ? `A change involving the board or a director's shareholding — ${party}.`
        : "A change involving the board or a director's shareholding.",
    matters:
      "Who runs the company matters, and directors buying or selling their own shares is one of the few signals that comes straight from insiders.",
    sentiment: "neutral",
  },
  AL: {
    happened: () => "The company is putting additional shares onto the market.",
    matters:
      "More shares in issue means each share you already hold owns a slightly smaller slice of the same company, unless the money raised earns its keep.",
    sentiment: "caution",
  },
  GA: {
    happened: () => "The company filed a general announcement with the exchange.",
    matters:
      "General announcements range from routine clarifications to material contracts, so it is worth opening the filing if it names a figure or a counterparty.",
    sentiment: "neutral",
  },
  OTHER: {
    happened: () => "The company made a regulatory filing to Bursa Malaysia.",
    matters:
      "Anything filed here is information the exchange requires every shareholder to see at the same time, so it is worth a look.",
    sentiment: "neutral",
  },
};

export function summariseFiling(title: string, category: FilingCategory): Eli5Summary {
  const template = FILING_TEXT[category] ?? FILING_TEXT.OTHER;
  return {
    happened: template.happened(filingParty(title)),
    matters: template.matters,
    sentiment: template.sentiment,
  };
}

export const SENTIMENT_LABEL: Record<Eli5Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  caution: "Caution",
};
