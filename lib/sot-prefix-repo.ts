import { getDb } from "./db";
import { collectPrefixes } from "./sot-prefix";

export interface ModelPrefix {
  id: number;
  prefix: string;
}

export interface PrefixBuildResult {
  added: number;
  skipped: number;
  total: number;
  builtAt: string;
}

function ensurePrefixTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS model_prefixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS model_prefix_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      built_at TEXT NOT NULL,
      added INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0
    );
  `);
}

// Sumber prefix per project: daftar target model (sot_project_members).
// Jika sebuah project tidak punya target model, nama project dipakai (sama seperti di macro VBA).
// Semua project ikut, termasuk yang tidak aktif: prefix adalah daftar kosakata yang hanya bertambah.
function loadSources(): string[] {
  const db = getDb();
  const tableExists = (name: string) =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
  if (!tableExists("sot_projects") || !tableExists("sot_project_members")) {
    throw new Error("Data project SOT belum ada. Jalankan Sinkron SOT lebih dulu.");
  }

  const rows = db
    .prepare(
      `SELECT p.id AS id, p.project_name AS project_name, m.source_name AS source_name
       FROM sot_projects p
       LEFT JOIN sot_project_members m ON m.project_id = p.id
       ORDER BY p.id, m.source_name`
    )
    .all() as unknown as { id: number; project_name: string; source_name: string | null }[];
  if (rows.length === 0) throw new Error("Belum ada project SOT. Jalankan Sinkron SOT lebih dulu.");

  const byProject = new Map<number, { name: string; members: string[] }>();
  for (const row of rows) {
    const entry = byProject.get(row.id) ?? { name: row.project_name, members: [] };
    if (row.source_name) entry.members.push(row.source_name);
    byProject.set(row.id, entry);
  }
  return [...byProject.values()].flatMap((p) => (p.members.length > 0 ? p.members : [p.name]));
}

/** Membangun daftar prefix dari data SOT di database. Hanya menambah, tidak pernah menghapus. */
export function buildModelPrefixes(): PrefixBuildResult {
  ensurePrefixTables();
  const { prefixes, skipped } = collectPrefixes(loadSources());

  const db = getDb();
  const builtAt = new Date().toISOString();
  let added = 0;
  let total = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    // Cek dulu baru insert: INSERT OR IGNORE pada AUTOINCREMENT tetap menghabiskan nomor id.
    const exists = db.prepare("SELECT 1 FROM model_prefixes WHERE prefix = ?");
    const insert = db.prepare("INSERT INTO model_prefixes (prefix) VALUES (?)");
    for (const prefix of prefixes) {
      if (exists.get(prefix)) continue;
      insert.run(prefix);
      added += 1;
    }
    total = Number((db.prepare("SELECT COUNT(*) AS n FROM model_prefixes").get() as { n: number }).n);
    db.prepare("INSERT INTO model_prefix_runs (built_at, added, skipped, total) VALUES (?, ?, ?, ?)").run(
      builtAt,
      added,
      skipped,
      total
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { added, skipped, total, builtAt };
}

export function getModelPrefixes(): ModelPrefix[] {
  ensurePrefixTables();
  return getDb()
    .prepare("SELECT id, prefix FROM model_prefixes ORDER BY id")
    .all() as unknown as ModelPrefix[];
}

export function getLastPrefixBuild() {
  ensurePrefixTables();
  return getDb()
    .prepare("SELECT built_at, added, skipped, total FROM model_prefix_runs ORDER BY id DESC LIMIT 1")
    .get() as { built_at: string; added: number; skipped: number; total: number } | undefined;
}

export function getPrefixSummary(): { total: number; builtAt: string | null } {
  ensurePrefixTables();
  const total = Number((getDb().prepare("SELECT COUNT(*) AS n FROM model_prefixes").get() as { n: number }).n);
  return { total, builtAt: getLastPrefixBuild()?.built_at ?? null };
}
