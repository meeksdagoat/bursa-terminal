"use client";

import { memo } from "react";
import type { FeedStatus } from "@/lib/market-status";

const COPY: Record<
  FeedStatus,
  { label: string; short: string; dot: string; text: string; border: string; pulse: boolean }
> = {
  live: {
    label: "LIVE · CONNECTED",
    short: "LIVE",
    dot: "bg-gain",
    text: "text-gain",
    border: "border-gain/40 bg-gain/10",
    pulse: true,
  },
  delayed: {
    label: "DELAYED 15M",
    short: "15M",
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-400/40 bg-amber-400/10",
    pulse: false,
  },
  closed: {
    label: "MARKET CLOSED",
    short: "CLOSED",
    dot: "bg-neutral-500",
    text: "text-neutral-400",
    border: "border-line bg-[#1a1a1a]",
    pulse: false,
  },
  connecting: {
    label: "CONNECTING",
    short: "…",
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-400/40 bg-amber-400/10",
    pulse: true,
  },
  reconnecting: {
    label: "RECONNECTING",
    short: "RETRY",
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-400/40 bg-amber-400/10",
    pulse: true,
  },
  error: {
    label: "DISCONNECTED",
    short: "OFF",
    dot: "bg-loss",
    text: "text-loss",
    border: "border-loss/40 bg-loss/10",
    pulse: false,
  },
};

type ConnectionStatusProps = {
  status: FeedStatus;
  compact?: boolean;
  latencyMs?: number | null;
};

function ConnectionStatusInner({ status, compact, latencyMs }: ConnectionStatusProps) {
  const look = COPY[status];
  const showLatency =
    !compact &&
    latencyMs != null &&
    (status === "live" || status === "delayed" || status === "closed");

  return (
    <span
      title={look.label}
      className={`inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-px ${look.border}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {look.pulse ? (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${look.dot}`} />
        ) : null}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${look.dot}`} />
      </span>
      <span className={`font-mono text-[8px] font-semibold uppercase tracking-[0.1em] ${look.text}`}>
        {compact ? look.short : look.label}
      </span>
      {showLatency ? (
        <span
          title="Quote feed round-trip"
          className="font-mono text-[8px] tabular-nums tracking-tight text-neutral-500"
        >
          {latencyMs}ms
        </span>
      ) : null}
    </span>
  );
}

export const ConnectionStatus = memo(ConnectionStatusInner);
