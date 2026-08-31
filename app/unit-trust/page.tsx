import type { Metadata } from "next";
import { UnitTrustDashboard } from "@/components/unit-trust/UnitTrustDashboard";

export const metadata: Metadata = {
  title: "Unit Trust Tracker · Bursa Terminal",
  description:
    "Track Malaysian unit trust funds — ASNB ASB/ASM/ASN series, Public Mutual, AHAM, Principal, Eastspring and Kenanga NAV and distributions.",
};

export default function UnitTrustPage() {
  return <UnitTrustDashboard />;
}
