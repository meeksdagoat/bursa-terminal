import type { NextRequest } from "next/server";
import { fetchFilingPdf, FilingPdfError, pdfResponse } from "@/lib/fetch-filing-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return errorResponse("Missing PDF URL", 400);

  try {
    const pdf = await fetchFilingPdf(url);
    return pdfResponse(pdf.body, pdf.filename, request.nextUrl.searchParams.get("download") === "1");
  } catch (error) {
    if (error instanceof FilingPdfError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Error fetching PDF", 500);
  }
}
