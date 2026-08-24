import "server-only";

import { cached } from "./cache";
import {
  isPlaceholderSummary,
  summariseHeadline,
  usableArticleText,
  type Eli5Summary,
  type HeadlineContext,
} from "./eli5";
import { fetchHtml } from "./rss";

export type NewsSummaryRequest = {
  title: string;
  snippet?: string | null;
  company?: string | null;
  symbol?: string | null;
  url?: string | null;
};

const SHORT_BODY_CHARS = 80;
const SCRAPE_TIMEOUT_MS = 5000;
const LLM_TIMEOUT_MS = 12_000;

function skipScrape(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("news.google.com") ||
      host.includes("localhost") ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(
    `<meta[^>]*${attr}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const b = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escaped}["'][^>]*>`,
    "i",
  );
  return a.exec(html)?.[1] ?? b.exec(html)?.[1] ?? null;
}

async function scrapeArticle(url: string | null | undefined): Promise<string | null> {
  if (!url || skipScrape(url)) return null;
  try {
    const html = await fetchHtml(url, SCRAPE_TIMEOUT_MS);
    const og = metaContent(html, "property", "og:description");
    const desc = metaContent(html, "name", "description");
    return usableArticleText(og ?? desc, undefined);
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function summariseWithLlm(
  title: string,
  body: string | null,
  extra: HeadlineContext,
): Promise<Eli5Summary | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const short = !body || body.length < SHORT_BODY_CHARS;
  const who = [extra.company, extra.symbol].filter(Boolean).join(" ");
  const prompt = short
    ? `The article body is empty or too short (paywall or empty RSS). Write exactly two sentences from the headline and company/ticker only. Do not invent figures, quotes or events that are not in the headline.`
    : `Summarise the article in exactly two sentences. Use only the provided text. Do not invent figures.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write plain-English explainers for a Malaysian Bursa terminal. Never use filler such as 'This is a news item' or 'This is a story about the market.' Return JSON with keys happened, matters, sentiment (positive|neutral|caution).",
          },
          {
            role: "user",
            content: [
              prompt,
              `Headline: ${title}`,
              who ? `Company/ticker: ${who}` : "Company/ticker: (none)",
              `Article text: ${body ?? "(none)"}`,
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      happened?: unknown;
      matters?: unknown;
      sentiment?: unknown;
    };
    const happened = typeof parsed.happened === "string" ? decodeEntities(parsed.happened).trim() : "";
    const matters = typeof parsed.matters === "string" ? decodeEntities(parsed.matters).trim() : "";
    const sentiment =
      parsed.sentiment === "positive" || parsed.sentiment === "caution" ? parsed.sentiment : "neutral";
    if (happened.length < 16 || matters.length < 16) return null;
    const summary: Eli5Summary = { happened, matters, sentiment };
    return isPlaceholderSummary(summary) ? null : summary;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prefer scraped/RSS body; if it is empty, expand the headline. Never return
 * shared placeholder copy — callers hide the card when this is null.
 */
export async function summariseNewsItem(input: NewsSummaryRequest): Promise<Eli5Summary | null> {
  const title = input.title.replace(/\s+/g, " ").trim();
  if (title.length < 16) return null;

  const extra: HeadlineContext = {
    snippet: input.snippet,
    company: input.company,
    symbol: input.symbol,
  };

  const rss = usableArticleText(input.snippet, title);
  const scraped = rss ? null : await scrapeArticle(input.url);
  const body = rss ?? scraped;

  const llm = await summariseWithLlm(title, body, extra);
  if (llm) return llm;

  return summariseHeadline(title, { ...extra, snippet: body ?? extra.snippet });
}

export async function cachedNewsSummary(input: NewsSummaryRequest): Promise<Eli5Summary | null> {
  const key = `news-summary:v1:${input.title}:${input.symbol ?? ""}:${input.url ?? ""}`;
  return cached(key, 10 * 60 * 1000, () => summariseNewsItem(input));
}
