"use client";

import { useCallback } from "react";
import { downloadCsv } from "@/lib/export";

/** `BursaTerminal_Maybank_Financials_2026.csv` */
export function csvFilename(...parts: Array<string | number | null | undefined>): string {
  const year = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" });
  const slug = parts
    .map((part) =>
      String(part ?? "")
        .replace(/\.KL$/i, "")
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, ""),
    )
    .filter((part) => part.length > 0)
    .join("_");
  return `BursaTerminal_${slug || "Export"}_${year}.csv`;
}

export function useExportToCSV() {
  return useCallback((filename: string, rows: Array<Array<string | number | null | undefined>>) => {
    downloadCsv(filename, rows);
  }, []);
}
