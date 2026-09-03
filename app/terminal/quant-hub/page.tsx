import type { Metadata } from "next";
import { QuantHub } from "@/components/QuantHub";

export const metadata: Metadata = {
  title: "Quant Hub · Bursa Terminal",
  description:
    "Multi-factor quant engine — weather anomalies, news velocity, FX beta, yield sensitivity and sector breadth.",
};

export default function QuantHubPage() {
  return <QuantHub />;
}
