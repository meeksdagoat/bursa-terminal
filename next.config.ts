import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yahoo-finance2 and duckdb ship native/node bindings; keep them out of the server bundle.
  serverExternalPackages: ["yahoo-finance2", "duckdb", "@duckdb/duckdb-wasm", "@prisma/client", "prisma"],
  async redirects() {
    return [
      {
        source: "/unit-trust",
        destination: "/terminal/market-hub",
        permanent: true,
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      canvg: "./lib/empty-module.ts",
      // Turbopack cannot parse duckdb's node-pre-gyp manifest — stub for dev/turbo builds.
      duckdb: "./lib/quant/duckdb-stub.ts",
    },
  },
};

export default nextConfig;