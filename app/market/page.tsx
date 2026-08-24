import { redirect } from "next/navigation";
import { isTrackedSymbol, terminalHref } from "@/lib/universe";

/** Older bookmarks used /market for the chart workspace. */
export default async function MarketAlias({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string | string[] }>;
}) {
  const requested = (await searchParams).symbol;
  const symbol = Array.isArray(requested) ? requested[0] : requested;

  redirect(symbol && isTrackedSymbol(symbol) ? terminalHref(symbol) : terminalHref());
}
