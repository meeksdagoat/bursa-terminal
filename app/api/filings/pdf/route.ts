import { NextRequest } from "next/server";
import { filingMatchesSymbol, getAnnouncementDetail, isAnnouncementId } from "@/lib/announcements";
import { cached } from "@/lib/cache";
import { fetchFilingPdf, FilingPdfError, pdfResponse } from "@/lib/fetch-filing-pdf";
import { entryBySymbol } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const docId = request.nextUrl.searchParams.get("docId") ?? "";
  const download = request.nextUrl.searchParams.get("download") === "1";
  const entry = entryBySymbol(symbol);

  if (!entry) {
    return Response.json({ error: `Unsupported symbol: ${symbol}` }, { status: 400 });
  }
  if (!isAnnouncementId(docId)) {
    return Response.json({ error: `Invalid filing id: ${docId}` }, { status: 400 });
  }

  try {
    const detail = await cached(`announcement:detail:v3:${docId}`, 10 * 60 * 1000, () =>
      getAnnouncementDetail(docId),
    );

    if (!filingMatchesSymbol(detail, entry)) {
      return Response.json(
        { error: `Filing ${docId} does not belong to ${entry.symbol}` },
        { status: 409 },
      );
    }

    if (!detail.pdfUrl) {
      return Response.json({ error: "No PDF attached to this filing" }, { status: 404 });
    }

    const pdf = await fetchFilingPdf(detail.pdfUrl);
    return pdfResponse(pdf.body, pdf.filename, download);
  } catch (error) {
    if (error instanceof FilingPdfError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const detail = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `PDF lookup failed: ${detail}` }, { status: 502 });
  }
}
