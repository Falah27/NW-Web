import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { runMigrations } from "./migrations";

const globalForDb = globalThis as unknown as { __teamHubDb?: DatabaseSyncType };

export function getDb(): DatabaseSyncType {
  if (!globalForDb.__teamHubDb) {
    const { DatabaseSync } = process.getBuiltinModule(
      "node:sqlite"
    ) as typeof import("node:sqlite");
    const databasePath = process.env.DATABASE_PATH ?? path.join("data", "dev.db");
    const db = new DatabaseSync(path.resolve(process.cwd(), databasePath));
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA foreign_keys = ON");
    runMigrations(db);
    globalForDb.__teamHubDb = db;
  }
  return globalForDb.__teamHubDb;
}