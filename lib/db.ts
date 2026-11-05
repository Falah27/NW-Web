import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const globalForDb = globalThis as unknown as { __teamHubDb?: DatabaseSyncType };

export function getDb(): DatabaseSyncType {
  if (!globalForDb.__teamHubDb) {
    const { DatabaseSync } = process.getBuiltinModule(
      "node:sqlite"
    ) as typeof import("node:sqlite");
    const db = new DatabaseSync(path.join(process.cwd(), "data", "dev.db"));
    db.exec("PRAGMA foreign_keys = ON");
    globalForDb.__teamHubDb = db;
  }
  return globalForDb.__teamHubDb;
}