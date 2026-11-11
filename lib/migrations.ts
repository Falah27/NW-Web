import type { DatabaseSync } from "node:sqlite";

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((item) => item.name === column);
}

function addColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function runMigrations(db: DatabaseSync): void {
  const version = Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, employee_id TEXT UNIQUE, role TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '[]', email TEXT);
      CREATE TABLE IF NOT EXISTS model_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, section TEXT);
      CREATE TABLE IF NOT EXISTS modules (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS stages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, sot_no TEXT, sot_status TEXT, model_group_id INTEGER NOT NULL REFERENCES model_groups(id),
        module_id INTEGER REFERENCES modules(id), stage_id INTEGER REFERENCES stages(id), job_item TEXT NOT NULL,
        assignee_id INTEGER REFERENCES members(id), detail_job TEXT, remarks TEXT, progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
        start_date TEXT, end_date TEXT, is_archived INTEGER NOT NULL DEFAULT 0, excel_row_key TEXT UNIQUE,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')), CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
      );
      CREATE INDEX IF NOT EXISTS jobs_filter_idx ON jobs (model_group_id, module_id, stage_id, assignee_id);
      CREATE INDEX IF NOT EXISTS jobs_dates_idx ON jobs (start_date, end_date);
      PRAGMA user_version = 1;
    `);
  }
  if (Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version) < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sot_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, external_key TEXT NOT NULL UNIQUE, fy TEXT NOT NULL, project_name TEXT NOT NULL, project_link TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen_at TEXT);
      CREATE TABLE IF NOT EXISTS sot_project_members (project_id INTEGER NOT NULL REFERENCES sot_projects(id) ON DELETE CASCADE, source_name TEXT NOT NULL, model_group_id INTEGER REFERENCES model_groups(id), mapping_status TEXT NOT NULL CHECK (mapping_status IN ('matched', 'needs_mapping')), PRIMARY KEY (project_id, source_name));
      CREATE TABLE IF NOT EXISTS sot_sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')), project_count INTEGER NOT NULL DEFAULT 0, member_count INTEGER NOT NULL DEFAULT 0, error_message TEXT);
      CREATE TABLE IF NOT EXISTS model_prefixes (id INTEGER PRIMARY KEY AUTOINCREMENT, prefix TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS model_prefix_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, built_at TEXT NOT NULL, added INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sot_model_mappings (source_name TEXT PRIMARY KEY COLLATE NOCASE, model_group_id INTEGER NOT NULL REFERENCES model_groups(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS sot_sync_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL REFERENCES sot_sync_runs(id) ON DELETE CASCADE, ts TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL);
    `);
    addColumn(db, "sot_sync_runs", "kind", "TEXT NOT NULL DEFAULT 'projects'");
    addColumn(db, "sot_sync_runs", "detail", "TEXT");
    addColumn(db, "sot_project_members", "mapping_method", "TEXT");
    db.exec("PRAGMA user_version = 2");
  }
  if (Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version) < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_events (id TEXT PRIMARY KEY, title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, kind TEXT NOT NULL CHECK (kind IN ('meeting', 'event', 'holiday')), CHECK (end_date IS NULL OR end_date >= start_date));
      CREATE INDEX IF NOT EXISTS team_events_dates_idx ON team_events (start_date, end_date);
      CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 3;
    `);
  }
  if (Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version) < 4) {
    addColumn(db, "jobs", "locally_modified", "INTEGER NOT NULL DEFAULT 0");
    db.exec("PRAGMA user_version = 4");
  }
}
