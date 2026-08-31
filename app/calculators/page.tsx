import type { Metadata } from "next";
import { CalculatorsPage } from "@/components/calculators/CalculatorsPage";

export const metadata: Metadata = {
  title: "Calculators & Planning · Bursa Terminal",
  description:
    "DCA accumulation simulator, Bursa Malaysia brokerage and stamp duty costs, and dividend reinvestment planning.",
};

export default function Page() {
  return <CalculatorsPage />;
}
