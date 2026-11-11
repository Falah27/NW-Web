import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../lib/migrations.ts";

test("migrations: database kosong naik ke versi 4 dan idempotent", () => {
  const db = new DatabaseSync(":memory:");
  runMigrations(db);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 4);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  assert.ok(tables.includes("jobs"));
  assert.ok(tables.includes("sot_model_mappings"));
  assert.ok(tables.includes("team_events"));
  const before = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get().n;
  runMigrations(db);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get().n, before);
});

test("migrations: tabel lama dan data tetap dipertahankan sampai versi 4", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE members (id INTEGER PRIMARY KEY, name TEXT UNIQUE); INSERT INTO members VALUES (1, 'Existing');");
  runMigrations(db);
  assert.equal(db.prepare("SELECT name FROM members WHERE id = 1").get().name, "Existing");
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 4);
});
