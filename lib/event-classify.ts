import type { AnnouncementCategory, CorporateEventType, EventImpact, EventSentiment } from "./types";

const POSITIVE = [
  "dividend",
  "special dividend",
  "profit",
  "record",
  "beat",
  "upgrade",
  "wins",
  "won",
  "award",
  "awarded",
  "secures",
  "secured",
  "growth",
  "higher",
  "improved",
  "expansion",
  "expands",
  "acquisition",
  "acquires",
  "buyback",
  "share buy",
];

const NEGATIVE = [
  "loss",
  "losses",
  "layoff",
  "retrench",
  "retrenchment",
  "fine",
  "fined",
  "compound",
  "suspend",
  "suspension",
  "warning",
  "profit warning",
  "miss",
  "decline",
  "drop",
  "plunge",
  "cut",
  "slashed",
  "downgrade",
  "default",
  "probe",
  "investigation",
  "fraud",
  "omitted dividend",
  "cancelled dividend",
];

export function classifyEventType(
  title: string,
  category?: AnnouncementCategory | null,
): CorporateEventType {
  const text = title.toLowerCase();

  if (category === "Dividend" || /\bdividend\b|\bentitlement\b|\bdps\b/.test(text)) return "dividend";
  if (
    category === "Financial Result" ||
    /quarterly rpt|quarterly report|financial results|annual audited|unaudited|q[1-4]\s|earnings/.test(text)
  ) {
    return "results";
  }
  if (/\bagm\b|annual general meeting|\begm\b|extraordinary general/.test(text)) return "agm";
  if (category === "Board Change" || /\bdirector\b|chief executive|board of directors|appointment of/.test(text)) {
    return "management";
  }
  if (/\bacquisition\b|\btakeover\b|\bmerger\b|\bdispose\b|\bdisposal\b|\bjoint venture\b/.test(text)) return "ma";
  if (/\bcontract\b|\bawarded\b|\border book\b|\bloi\b/.test(text)) return "contract";
  if (/\blayoff\b|\bretrench\b|\bworkforce reduction\b|\bredundan/.test(text)) return "layoffs";
  if (/\bfine\b|\bcompound\b|\bregulator\b|\bbnm\b|\bsuspend\b|\binvestigation\b/.test(text)) {
    return "regulatory";
  }
  if (/\bexpansion\b|\bcapex\b|\bnew plant\b|\bfacility\b/.test(text)) return "expansion";
  return "news";
}

export function classifyEventSentiment(
  title: string,
  category?: AnnouncementCategory | null,
): EventSentiment {
  const text = title.toLowerCase();
  if (NEGATIVE.some((keyword) => text.includes(keyword))) return "negative";
  if (POSITIVE.some((keyword) => text.includes(keyword))) return "positive";

  if (category === "Dividend") return "positive";
  if (category === "Financial Result") return "neutral";
  if (category === "Board Change") return "neutral";
  return "neutral";
}

export function classifyEventImpact(type: CorporateEventType, sentiment: EventSentiment): EventImpact {
  if (type === "results" || type === "ma" || type === "layoffs" || type === "regulatory") return "high";
  if (type === "dividend" || type === "contract" || type === "expansion") return "medium";
  if (sentiment === "negative") return "medium";
  return "low";
}

export const EVENT_TYPE_LABEL: Record<CorporateEventType, string> = {
  results: "Financial results",
  dividend: "Dividend",
  agm: "AGM",
  management: "Board change",
  ma: "M&A",
  contract: "Contract",
  expansion: "Expansion",
  layoffs: "Layoffs",
  regulatory: "Regulatory",
  news: "News",
};

export const EVENT_SENTIMENT_LABEL: Record<EventSentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

export const EVENT_SENTIMENT_BADGE: Record<EventSentiment, string> = {
  positive: "border-gain/45 bg-gain/10 text-gain",
  negative: "border-loss/45 bg-loss/10 text-loss",
  neutral: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};
