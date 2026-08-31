import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yahoo-finance2 ships its own Node polyfills; keep it out of the server bundle.
  serverExternalPackages: ["yahoo-finance2", "duckdb", "@duckdb/duckdb-wasm"],
  turbopack: {
    resolveAlias: {
      canvg: "./lib/empty-module.ts",
    },
  },
};

export default nextConfig;