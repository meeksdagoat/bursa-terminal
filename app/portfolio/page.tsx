import type { Metadata } from "next";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";

export const metadata: Metadata = {
  title: "My Portfolio · Bursa Terminal",
  description: "Track Bursa Malaysia holdings, live P&L and allocation.",
};

export default function PortfolioPage() {
  return <PortfolioDashboard />;
}
