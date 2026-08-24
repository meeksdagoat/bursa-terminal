import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeOverview } from "@/components/home-overview";
import { DEFAULT_CATEGORY, isHeadlineCategory } from "@/lib/categories";

export const metadata: Metadata = {
  title: "News · Bursa Terminal",
  description:
    "Malaysia politics, economy, company and world news alongside live Bursa quotes.",
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ desk?: string | string[] }>;
}) {
  const requested = (await searchParams).desk;
  const desk = Array.isArray(requested) ? requested[0] : requested;

  if (desk === "global-economy") {
    redirect("/global-economy");
  }

  return (
    <HomeOverview category={isHeadlineCategory(desk) ? desk : DEFAULT_CATEGORY} />
  );
}
