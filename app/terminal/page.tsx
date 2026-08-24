import type { Metadata } from "next";
import { TerminalDashboard } from "@/components/terminal-dashboard";
import { DEFAULT_WATCHLIST, isTrackedSymbol } from "@/lib/universe";

export const metadata: Metadata = {
  title: "Terminal · Bursa Terminal",
  description:
    "Live Bursa Malaysia charts, watchlist, top gainers and losers, and company-scoped news.",
};

export default async function TerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string | string[] }>;
}) {
  const requested = (await searchParams).symbol;
  const symbol = Array.isArray(requested) ? requested[0] : requested;

  return (
    <TerminalDashboard
      initialSymbol={symbol && isTrackedSymbol(symbol) ? symbol : DEFAULT_WATCHLIST[0]}
    />
  );
}
