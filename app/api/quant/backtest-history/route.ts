import type { NextRequest } from "next/server";
import { handleBacktestHistoryGet } from "@/lib/quant/backtest-history-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleBacktestHistoryGet(request);
}
