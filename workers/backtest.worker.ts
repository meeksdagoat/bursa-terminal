/// <reference lib="webworker" />

import { runBacktest, type BacktestResult } from "@/lib/quant/backtest";

export type BacktestWorkerRequest = {
  id: string;
  input: Parameters<typeof runBacktest>[0];
};

export type BacktestWorkerResponse =
  | { id: string; result: BacktestResult }
  | { id: string; error: string };

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<BacktestWorkerRequest>) => {
  const { id, input } = event.data;
  try {
    const result = runBacktest(input);
    const response: BacktestWorkerResponse = { id, result };
    self.postMessage(response);
  } catch (error) {
    const response: BacktestWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : "Backtest worker failed",
    };
    self.postMessage(response);
  }
};

export {};
