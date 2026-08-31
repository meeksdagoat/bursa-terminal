/** Async backtest runner — offloads heavy loops to a Web Worker when available. */

import { runBacktest, type BacktestResult } from "@/lib/quant/backtest";
import type {
  BacktestWorkerRequest,
  BacktestWorkerResponse,
} from "@/workers/backtest.worker";

let worker: Worker | null = null;
let workerFailed = false;

function getBacktestWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;

  if (!worker) {
    try {
      worker = new Worker(new URL("../../workers/backtest.worker.ts", import.meta.url));
      worker.addEventListener("error", () => {
        workerFailed = true;
        worker?.terminate();
        worker = null;
      });
    } catch {
      workerFailed = true;
      return null;
    }
  }

  return worker;
}

export function runStrategyBacktest(
  input: Parameters<typeof runBacktest>[0],
): Promise<BacktestResult> {
  const activeWorker = getBacktestWorker();

  if (!activeWorker) {
    return Promise.resolve(runBacktest(input));
  }

  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const workerRef = activeWorker;

    function onMessage(event: MessageEvent<BacktestWorkerResponse>) {
      if (event.data.id !== id) return;
      workerRef.removeEventListener("message", onMessage);
      workerRef.removeEventListener("error", onError);

      if ("error" in event.data) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(event.data.result);
    }

    function onError() {
      workerRef.removeEventListener("message", onMessage);
      workerRef.removeEventListener("error", onError);
      workerFailed = true;
      workerRef.terminate();
      worker = null;
      resolve(runBacktest(input));
    }

    workerRef.addEventListener("message", onMessage);
    workerRef.addEventListener("error", onError);

    const request: BacktestWorkerRequest = { id, input };
    workerRef.postMessage(request);
  });
}
