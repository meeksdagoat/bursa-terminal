import type { NextRequest } from "next/server";
import { fetchFilingPdf, FilingPdfError, pdfErrorResponse, pdfResponse } from "@/lib/fetch-filing-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return Response.json({ error: "Missing PDF URL", code: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const pdf = await fetchFilingPdf(url);
    return pdfResponse(pdf.body, pdf.filename, request.nextUrl.searchParams.get("download") === "1");
  } catch (error) {
    if (error instanceof FilingPdfError) {
      return pdfErrorResponse(error);
    }
    return Response.json({ error: "Error fetching PDF", code: "UPSTREAM_ERROR" }, { status: 500 });
  }
}
