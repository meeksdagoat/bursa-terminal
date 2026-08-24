import type { NextRequest } from "next/server";
import { cachedNewsSummary } from "@/lib/summarize-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ summary: null }, { status: 400 });
  }

  const rec = typeof body === "object" && body != null ? (body as Record<string, unknown>) : {};
  const title = str(rec.title);
  if (!title) return Response.json({ summary: null }, { status: 400 });

  try {
    const summary = await cachedNewsSummary({
      title,
      snippet: str(rec.snippet),
      company: str(rec.company),
      symbol: str(rec.symbol),
      url: str(rec.url),
    });
    return Response.json(
      { summary },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ summary: null }, { status: 200 });
  }
}
