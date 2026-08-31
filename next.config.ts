import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yahoo-finance2 and duckdb ship native/node bindings; keep them out of the server bundle.
  serverExternalPackages: ["yahoo-finance2", "duckdb", "@duckdb/duckdb-wasm"],
  turbopack: {
    resolveAlias: {
      canvg: "./lib/empty-module.ts",
      // Turbopack cannot parse duckdb's node-pre-gyp manifest — stub for dev/turbo builds.
      duckdb: "./lib/quant/duckdb-stub.ts",
    },
  },
};

export default nextConfig;