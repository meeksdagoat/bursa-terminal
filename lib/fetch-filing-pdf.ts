import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const REFERER =
  "https://www.bursamalaysia.com/market_information/announcements/company_announcement";

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

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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

function runCurl(args: string[]): Promise<{ code: number | null; stderr: string }> {
  const bin = process.platform === "win32" ? "curl.exe" : "curl";
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    const errChunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));
    child.on("error", () => reject(new FilingPdfError("PDF fetch tool unavailable", 500)));
    child.on("close", (code) => {
      resolve({ code, stderr: Buffer.concat(errChunks).toString("utf8") });
    });
  });
}

/**
 * Cloudflare often 403s Node's TLS fingerprint. curl + a warmed cookie jar
 * from the Bursa announcements page succeeds more often on the same host.
 */
async function fetchPdfViaCurl(target: URL): Promise<ArrayBuffer> {
  const dir = await mkdtemp(join(tmpdir(), "bursa-pdf-"));
  const jar = join(dir, "cookies.txt");
  const out = join(dir, "filing.pdf");

  try {
    // Warm Cloudflare / session cookies against the public announcements shell.
    await runCurl([
      "-sS",
      "-L",
      "--max-time",
      "15",
      "-A",
      USER_AGENT,
      "-c",
      jar,
      "-b",
      jar,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: en-MY,en;q=0.9",
      REFERER,
    ]);

    const download = await runCurl([
      "-sS",
      "-L",
      "--fail",
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
      "Accept: application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: en-MY,en;q=0.9",
      "-H",
      `Referer: ${REFERER}`,
      "-H",
      "Sec-Fetch-Dest: document",
      "-H",
      "Sec-Fetch-Mode: navigate",
      "-H",
      "Sec-Fetch-Site: same-site",
      "-o",
      out,
      "-w",
      "%{http_code}",
      target.href,
    ]);

    if (download.code !== 0) {
      const status = download.stderr.match(/\b(\d{3})\b/)?.[1];
      throw new FilingPdfError(
        status ? `Upstream PDF responded ${status}` : "Upstream PDF responded 403",
        502,
      );
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

async function fetchPdfViaHttp(target: URL): Promise<{ body: ArrayBuffer; filename: string }> {
  // Warm a lightweight HTML hit first so subsequent disclosure downloads
  // sometimes inherit Cloudflare clearance cookies in the undici jar.
  try {
    await fetch(REFERER, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-MY,en;q=0.9",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Warm-up is best-effort.
  }

  const response = await fetch(target, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-MY,en;q=0.9",
      Referer: REFERER,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-site",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new FilingPdfError(`Upstream PDF responded ${response.status}`, 502);
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

/** Fetch a Bursa disclosure PDF and return the bytes. Hosts are allowlisted to avoid an open proxy. */
export async function fetchFilingPdf(rawUrl: string): Promise<{
  body: ArrayBuffer;
  filename: string;
}> {
  const target = assertAllowedPdfUrl(rawUrl);

  try {
    return await fetchPdfViaHttp(target);
  } catch (error) {
    if (error instanceof FilingPdfError && (error.status === 400 || error.status === 413)) {
      throw error;
    }
    try {
      const body = await fetchPdfViaCurl(target);
      if (!bodyLooksLikePdf(body)) {
        throw error instanceof FilingPdfError
          ? error
          : new FilingPdfError("Upstream did not return a PDF", 502);
      }
      return { body, filename: filenameFromUrl(target) };
    } catch (curlError) {
      throw curlError instanceof FilingPdfError
        ? curlError
        : error instanceof FilingPdfError
          ? error
          : new FilingPdfError("Upstream PDF responded 403", 502);
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
      "Access-Control-Allow-Origin": "*",
    },
  });
}
