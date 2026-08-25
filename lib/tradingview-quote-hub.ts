import "server-only";

import { GLOBAL_TICKER_SPECS, tickerSpecByTv } from "./global-ticker-catalog";
import type { GlobalTickerQuote, GlobalTickersPayload } from "./types";

const TV_SOCKET = "wss://data.tradingview.com/socket.io/websocket";
const TV_ORIGIN = "https://www.tradingview.com";
const FIELDS = ["lp", "ch", "chp", "volume", "short_name", "description"] as const;

type TickListener = (ticker: GlobalTickerQuote) => void;

type TvClientOptions = {
  headers?: Record<string, string>;
};

function pack(payload: unknown): string {
  const body = JSON.stringify(payload);
  return `~m~${body.length}~m~${body}`;
}

function emptyTickers(): GlobalTickerQuote[] {
  return GLOBAL_TICKER_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    symbol: spec.symbol,
    unit: spec.unit,
    kind: spec.kind,
    price: null,
    changePct: null,
    currency: spec.kind === "yield" ? null : "USD",
    asOf: null,
  }));
}

function toPayload(tickers: GlobalTickerQuote[], errors: string[]): GlobalTickersPayload {
  return {
    source: "tradingview",
    asOf: new Date().toISOString(),
    tickers,
    errors,
  };
}

class TradingViewQuoteHub {
  private socket: WebSocket | null = null;
  private buffer = "";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private started = false;
  private lastError: string | null = null;
  private session = "qs_bursa";
  private readonly quotes = new Map<string, GlobalTickerQuote>(
    emptyTickers().map((row) => [row.id, row]),
  );
  private readonly listeners = new Set<TickListener>();

  start(): void {
    if (this.started) return;
    this.started = true;
    this.connect();
  }

  snapshot(): GlobalTickersPayload {
    return toPayload([...this.quotes.values()], this.lastError ? [this.lastError] : []);
  }

  subscribe(listener: TickListener): () => void {
    this.start();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async ready(timeoutMs = 2500): Promise<GlobalTickersPayload> {
    this.start();
    const filled = [...this.quotes.values()].filter((row) => row.price != null).length;
    if (filled === GLOBAL_TICKER_SPECS.length) return this.snapshot();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        unsub();
        resolve(this.snapshot());
      }, timeoutMs);

      const unsub = this.subscribe(() => {
        const count = [...this.quotes.values()].filter((row) => row.price != null).length;
        if (count < GLOBAL_TICKER_SPECS.length) return;
        clearTimeout(timer);
        unsub();
        resolve(this.snapshot());
      });
    });
  }

  private connect(): void {
    this.buffer = "";
    this.session = `qs_${Math.random().toString(36).slice(2, 10)}`;
    try {
      const Socket = WebSocket as unknown as new (url: string, init?: TvClientOptions) => WebSocket;
      this.socket = new Socket(TV_SOCKET, { headers: { Origin: TV_ORIGIN } });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.send("set_auth_token", ["unauthorized_user_token"]);
      this.send("quote_create_session", [this.session]);
      this.send("quote_set_fields", [this.session, ...FIELDS]);
      this.send(
        "quote_add_symbols",
        [this.session, ...GLOBAL_TICKER_SPECS.map((spec) => spec.tv)],
      );
    });

    this.socket.addEventListener("message", (event) => {
      this.buffer += typeof event.data === "string" ? event.data : String(event.data);
      this.drain();
    });

    this.socket.addEventListener("error", () => {
      this.lastError = "TradingView websocket error";
    });

    this.socket.addEventListener("close", () => {
      this.socket = null;
      this.scheduleReconnect();
    });
  }

  private send(method: string, params: unknown[]): void {
    this.socket?.send(pack({ m: method, p: params }));
  }

  private drain(): void {
    while (true) {
      const header = this.buffer.match(/^~m~(\d+)~m~/);
      if (!header) {
        if (this.buffer.length > 1_000_000) this.buffer = "";
        return;
      }
      const length = Number(header[1]);
      const start = header[0].length;
      if (this.buffer.length < start + length) return;
      const chunk = this.buffer.slice(start, start + length);
      this.buffer = this.buffer.slice(start + length);
      this.handleChunk(chunk);
    }
  }

  private handleChunk(chunk: string): void {
    if (chunk.startsWith("~h~")) {
      this.socket?.send(`~m~${chunk.length}~m~${chunk}`);
      return;
    }

    let message: { m?: string; p?: unknown };
    try {
      message = JSON.parse(chunk) as { m?: string; p?: unknown };
    } catch {
      return;
    }

    if (message.m !== "qsd" || !Array.isArray(message.p)) return;
    const payload = message.p[1] as { n?: string; v?: Record<string, unknown> } | undefined;
    const tvSymbol = payload?.n;
    const values = payload?.v;
    if (!tvSymbol || !values) return;

    const spec = tickerSpecByTv(tvSymbol);
    if (!spec) return;

    const lp = typeof values.lp === "number" && Number.isFinite(values.lp) ? values.lp : null;
    const chp = typeof values.chp === "number" && Number.isFinite(values.chp) ? values.chp : null;
    if (lp == null && chp == null) return;

    const previous = this.quotes.get(spec.id);
    const next: GlobalTickerQuote = {
      id: spec.id,
      label: spec.label,
      symbol: spec.symbol,
      unit: spec.unit,
      kind: spec.kind,
      price: lp ?? previous?.price ?? null,
      changePct: chp ?? previous?.changePct ?? null,
      currency: spec.kind === "yield" ? null : "USD",
      asOf: new Date().toISOString(),
    };
    this.quotes.set(spec.id, next);
    for (const listener of this.listeners) listener(next);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(15_000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

const globalStore = globalThis as typeof globalThis & {
  __bursaTvQuoteHub?: TradingViewQuoteHub;
};

export function getTradingViewQuoteHub(): TradingViewQuoteHub {
  return (globalStore.__bursaTvQuoteHub ??= new TradingViewQuoteHub());
}

export async function getGlobalTickers(): Promise<GlobalTickersPayload> {
  return getTradingViewQuoteHub().ready();
}
