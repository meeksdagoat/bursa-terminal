/** Stub used by Turbopack — native DuckDB is externalized under the webpack production build. */

export class Database {
  constructor(_path: string) {
    throw new Error(
      "DuckDB native bindings are unavailable in this bundle. " +
        "Parquet cache queries require a webpack server build.",
    );
  }

  connect(): Connection {
    throw new Error("DuckDB stub — not available under Turbopack.");
  }

  close(): void {}
}

export class Connection {
  all(_sql: string, ..._args: unknown[]): void {}

  close(): void {}
}

const DuckDbStub = { Database, Connection };

export default DuckDbStub;
