import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { deskHref, isHeadlineCategory } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Bursa Terminal — The Financial Workspace for the Malaysian Market",
  description:
    "Live Bursa Malaysia stocks, Bank Negara rates, Shariah screening, and plain-English filing summaries in one terminal.",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const requested = (await searchParams).desk;
  const desk = Array.isArray(requested) ? requested[0] : requested;

  if (isHeadlineCategory(desk)) {
    redirect(deskHref(desk));
  }

  return <LandingPage />;
}
