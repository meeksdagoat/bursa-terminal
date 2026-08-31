import type { Metadata } from "next";
import { MarketHubView } from "@/components/market-hub/market-hub-view";

export const metadata: Metadata = {
  title: "Market Hub · Bursa Terminal",
  description:
    "Bursa Malaysia Market Hub — FBM benchmarks, ICB sectors, BMD derivatives, REITs and ETFs.",
};

export default function MarketHubPage() {
  return <MarketHubView />;
}
