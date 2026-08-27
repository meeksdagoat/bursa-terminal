import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Chrome-like headers — Bursa WAF rejects bare Node / datacenter fingerprints. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const REFERER = "https://www.bursamalaysia.com/";

const ANNOUNCEMENTS_PAGE =
  "https://www.bursamalaysia.com/market_information/announcements/company_announcement";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: REFERER,
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1",
};

const ALLOWED_HOSTS = new Set([
  "disclosure.bursamalaysia.com",
  "www.disclosure.bursamalaysia.com",
  "www.bursamalaysia.com",
  "bursamalaysia.com",
  "www.klsescreener.com",
  "klsescreener.com",
]);

const MAX_BYTES = 25 * 1024 * 1024;

export class FilingPdfError extends Error {
  status: number;
  upstreamStatus?: number;

  constructor(message: string, status: number, upstreamStatus?: number) {
    super(message);
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

function assertAllowedPdfUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new FilingPdfError("Invalid PDF URL", 400);
  }

  if (parsed.protocol !== "https:") {
    throw new FilingPdfError("PDF URL must be https", 400);
  }
  if (parsed.username || parsed.password) {
    throw new FilingPdfError("PDF URL must not include credentials", 400);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new FilingPdfError("PDF host is not allowed", 400);
  }
  return parsed;
}

/** `%PDF-` may sit after a BOM or a few whitespace bytes. Scan the first 1KB. */
function bodyLooksLikePdf(body: ArrayBuffer): boolean {
  const head = new Uint8Array(body.slice(0, Math.min(1024, body.byteLength)));
  for (let i = 0; i <= head.length - 5; i++) {
    if (
      head[i] === 0x25 &&
      head[i + 1] === 0x50 &&
      head[i + 2] === 0x44 &&
      head[i + 3] === 0x46 &&
      head[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

function filenameFromUrl(target: URL): string {
  const named = target.searchParams.get("name");
  if (!named) return "filing.pdf";
  const cleaned = named.replace(/[^\w.\-]+/g, "_");
  return cleaned.endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function filenameFromDisposition(disposition: string | null): string {
  const named = disposition?.match(/filename\*?=(?:UTF-8'')?["']?([^";\n]+)/i)?.[1];
  const filename = decodeURIComponent(named ?? "filing.pdf").replace(/[^\w.\-]+/g, "_");
  return filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function collectSetCookies(response: Response): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const listed = headers.getSetCookie?.() ?? [];
  if (listed.length > 0) {
    return listed.map((cookie) => cookie.split(";")[0]?.trim()).filter(Boolean).join("; ");
  }
  const single = response.headers.get("set-cookie");
  if (!single) return undefined;
  return single.split(",").map((part) => part.split(";")[0]?.trim()).filter(Boolean).join("; ");
}

function runCurl(args: string[]): Promise<{ code: number | null; stderr: string }> {
  const bin = process.platform === "win32" ? "curl.exe" : "curl";
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    const errChunks: Buffer[] = [];
    // Drain stdout so a full pipe never blocks the child.
    child.stdout?.on("data", () => undefined);
    child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));
    child.on("error", () => reject(new FilingPdfError("PDF fetch tool unavailable", 500)));
    child.on("close", (code) => {
      resolve({ code, stderr: Buffer.concat(errChunks).toString("utf8") });
    });
  });
}

/**
 * Local Windows: curl often clears Cloudflare where Node's TLS fingerprint
 * cannot. Vercel/datacenter IPs are still frequently 403'd regardless.
 */
async function fetchPdfViaCurl(target: URL): Promise<ArrayBuffer> {
  const dir = await mkdtemp(join(tmpdir(), "bursa-pdf-"));
  const jar = join(dir, "cookies.txt");
  const out = join(dir, "filing.pdf");

  try {
    await runCurl([
      "-sS",
      "-L",
      "--connect-timeout",
      "5",
      "--max-time",
      "8",
      "-A",
      USER_AGENT,
      "-c",
      jar,
      "-b",
      jar,
      "-H",
      `Accept: ${BROWSER_HEADERS.Accept}`,
      "-H",
      `Accept-Language: ${BROWSER_HEADERS["Accept-Language"]}`,
      "-H",
      `Referer: ${REFERER}`,
      ANNOUNCEMENTS_PAGE,
    ]);

    const download = await runCurl([
      "-sS",
      "-L",
      "--fail",
      "--connect-timeout",
      "10",
      "--max-time",
      "25",
      "--max-filesize",
      String(MAX_BYTES),
      "-A",
      USER_AGENT,
      "-c",
      jar,
      "-b",
      jar,
      "-H",
      `Accept: ${BROWSER_HEADERS.Accept}`,
      "-H",
      `Accept-Language: ${BROWSER_HEADERS["Accept-Language"]}`,
      "-H",
      `Referer: ${REFERER}`,
      "-H",
      "Sec-Fetch-Dest: document",
      "-H",
      "Sec-Fetch-Mode: navigate",
      "-H",
      "Sec-Fetch-Site: cross-site",
      "-o",
      out,
      target.href,
    ]);

    if (download.code !== 0) {
      const status = Number(download.stderr.match(/\b(\d{3})\b/)?.[1] ?? 403);
      throw new FilingPdfError(`Upstream PDF responded ${status}`, 502, status);
    }

    const body = bufferToArrayBuffer(await readFile(out));
    if (body.byteLength === 0) {
      throw new FilingPdfError("Upstream returned an empty PDF", 502);
    }
    return body;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Node fetch with Chrome headers + optional cookie warm-up from Bursa HTML. */
async function fetchPdfViaHttp(target: URL): Promise<{ body: ArrayBuffer; filename: string }> {
  let cookieHeader: string | undefined;
  try {
    const warm = await fetch(ANNOUNCEMENTS_PAGE, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Dest": "document",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    cookieHeader = collectSetCookies(warm);
  } catch {
    // Warm-up is best-effort.
  }

  const response = await fetch(target, {
    headers: {
      ...BROWSER_HEADERS,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new FilingPdfError(`Upstream PDF responded ${response.status}`, 502, response.status);
  }

  const finalUrl = response.url ? new URL(response.url) : target;
  if (!ALLOWED_HOSTS.has(finalUrl.hostname.toLowerCase())) {
    throw new FilingPdfError("Redirected PDF host is not allowed", 400);
  }

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
    throw new FilingPdfError("PDF is too large to preview", 413);
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    throw new FilingPdfError("PDF is too large to preview", 413);
  }

  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!bodyLooksLikePdf(body) && !type.includes("pdf")) {
    throw new FilingPdfError("Upstream did not return a PDF", 502);
  }

  return { body, filename: filenameFromDisposition(response.headers.get("content-disposition")) };
}

/**
 * Fetch a Bursa disclosure PDF.
 * - Local: prefer curl (clears WAF more often on residential paths).
 * - Vercel: prefer HTTP with browser headers (no reliable curl / same DC IP block).
 */
export async function fetchFilingPdf(rawUrl: string): Promise<{
  body: ArrayBuffer;
  filename: string;
}> {
  const target = assertAllowedPdfUrl(rawUrl);
  const onVercel = Boolean(process.env.VERCEL);

  const viaHttp = () => fetchPdfViaHttp(target);
  const viaCurl = async () => {
    const body = await fetchPdfViaCurl(target);
    if (!bodyLooksLikePdf(body)) {
      throw new FilingPdfError("Upstream did not return a PDF", 502);
    }
    return { body, filename: filenameFromUrl(target) };
  };

  const primary = onVercel ? viaHttp : viaCurl;
  const secondary = onVercel ? viaCurl : viaHttp;

  try {
    return await primary();
  } catch (primaryError) {
    if (
      primaryError instanceof FilingPdfError &&
      (primaryError.status === 400 || primaryError.status === 413)
    ) {
      throw primaryError;
    }
    try {
      return await secondary();
    } catch (secondaryError) {
      throw secondaryError instanceof FilingPdfError
        ? secondaryError
        : primaryError instanceof FilingPdfError
          ? primaryError
          : new FilingPdfError("Upstream PDF responded 403", 502, 403);
    }
  }
}

export function pdfResponse(body: ArrayBuffer, filename: string, download = false): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Structured error body for clients that need a Bursa fallback CTA. */
export function pdfErrorResponse(error: FilingPdfError): Response {
  return Response.json(
    {
      error: error.message,
      code:
        error.upstreamStatus === 403 || /403/.test(error.message)
          ? "UPSTREAM_FORBIDDEN"
          : "UPSTREAM_ERROR",
      upstreamStatus: error.upstreamStatus ?? null,
      fallback: "open_upstream",
    },
    { status: error.status },
  );
}
