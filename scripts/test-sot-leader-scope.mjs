import test from "node:test";
import assert from "node:assert/strict";
import { applyLeaderFilterInTransaction } from "./sot/leader-scope.mjs";

function createDb() {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE sot_projects (external_key TEXT PRIMARY KEY, fy TEXT NOT NULL, is_active INTEGER NOT NULL)");
  db.exec("INSERT INTO sot_projects VALUES ('/p1', 'FY18', 1), ('/p2', 'FY18', 1), ('/p3', 'FY19', 0), ('/p4', 'FY19', 1), ('/p5', 'FY20', 0)");
  return db;
}

function rows(db) {
  return db.prepare("SELECT external_key, fy, is_active FROM sot_projects ORDER BY external_key").all().map((row) => ({ ...row }));
}

test("scope FY mengaktifkan keptKeys dan menonaktifkan sisanya", () => {
  const db = createDb();
  db.exec("BEGIN IMMEDIATE");
  const result = applyLeaderFilterInTransaction(db, ["FY18"], ["/p2"]);
  db.exec("COMMIT");
  assert.deepEqual(result, { kept: 1, deactivated: 1 });
  assert.deepEqual(rows(db), [
    { external_key: "/p1", fy: "FY18", is_active: 0 },
    { external_key: "/p2", fy: "FY18", is_active: 1 },
    { external_key: "/p3", fy: "FY19", is_active: 0 },
    { external_key: "/p4", fy: "FY19", is_active: 1 },
    { external_key: "/p5", fy: "FY20", is_active: 0 },
  ]);
});

test("FY di luar scope tidak berubah", () => {
  const db = createDb();
  db.exec("BEGIN IMMEDIATE");
  applyLeaderFilterInTransaction(db, ["FY18"], ["/p1"]);
  db.exec("COMMIT");
  assert.equal(db.prepare("SELECT is_active FROM sot_projects WHERE external_key = '/p4'").get().is_active, 1);
  assert.equal(db.prepare("SELECT is_active FROM sot_projects WHERE external_key = '/p5'").get().is_active, 0);
});

test("keptKeys yang tidak ada di database diabaikan", () => {
  const db = createDb();
  db.exec("BEGIN IMMEDIATE");
  const result = applyLeaderFilterInTransaction(db, ["FY18"], ["/missing"]);
  db.exec("COMMIT");
  assert.deepEqual(result, { kept: 0, deactivated: 2 });
});

test("error di tengah transaksi dapat di-rollback tanpa perubahan", () => {
  const db = createDb();
  const before = rows(db);
  db.exec("BEGIN IMMEDIATE");
  applyLeaderFilterInTransaction(db, ["FY18"], ["/p2"]);
  db.exec("ROLLBACK");
  assert.deepEqual(rows(db), before);
});
