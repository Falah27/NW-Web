import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/dev.db");

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sot_model_mappings (
      source_name TEXT PRIMARY KEY COLLATE NOCASE,
      model_group_id INTEGER NOT NULL REFERENCES model_groups(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log("Migrasi SOT selesai: tabel sot_model_mappings siap.");
} finally {
  db.close();
}
