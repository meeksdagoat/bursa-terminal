import type { Metadata } from "next";
import { ScreenerPage } from "@/components/screener-page";

export const metadata: Metadata = {
  title: "Screener · Bursa Terminal",
  description:
    "Multi-factor screen of Bursa Malaysia stocks by P/E, dividend yield, market cap, sector and Shariah status.",
};

export default function Page() {
  return <ScreenerPage />;
}
