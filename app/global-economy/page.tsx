import type { Metadata } from "next";
import { GlobalEconomyView } from "@/components/global-economy-view";

export const metadata: Metadata = {
  title: "Global Economy · Bursa Terminal",
  description:
    "Fed, ECB, BOJ and PBOC policy rates alongside US Treasuries, global indices and the macro calendar.",
};

export default function GlobalEconomyPage() {
  return <GlobalEconomyView />;
}
