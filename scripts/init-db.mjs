import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { jobs } from "../lib/mock-data.ts";
import { members } from "../lib/mock-members.ts";

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "dev.db");
fs.rmSync(file, { force: true });

const db = new DatabaseSync(file);
db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  employee_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '[]',
  email TEXT
);
CREATE TABLE model_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  section TEXT
);
CREATE TABLE modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER
);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  sot_no TEXT,
  sot_status TEXT,
  model_group_id INTEGER NOT NULL REFERENCES model_groups(id),
  module_id INTEGER REFERENCES modules(id),
  stage_id INTEGER REFERENCES stages(id),
  job_item TEXT NOT NULL,
  assignee_id INTEGER REFERENCES members(id),
  detail_job TEXT,
  remarks TEXT,
  progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  start_date TEXT,
  end_date TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  excel_row_key TEXT UNIQUE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX jobs_filter_idx ON jobs (model_group_id, module_id, stage_id, assignee_id);
CREATE INDEX jobs_dates_idx ON jobs (start_date, end_date);
`);

function idOf(table, name) {
  if (!name) return null;
  db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name);
  return db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name).id;
}

db.exec("BEGIN");
try {
  const insMember = db.prepare(
    "INSERT OR IGNORE INTO members (name, role, skills, email) VALUES (?, ?, ?, ?)"
  );
  for (const m of members) {
    insMember.run(m.name, m.role, JSON.stringify(m.skills), m.email ?? null);
  }

  const insJob = db.prepare(`
    INSERT INTO jobs (id, sot_no, sot_status, model_group_id, module_id, stage_id,
      job_item, assignee_id, detail_job, remarks, progress, start_date, end_date, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const j of jobs) {
    insJob.run(
      j.id, j.sotNo ?? null, j.sotStatus ?? null,
      idOf("model_groups", j.model), idOf("modules", j.module), idOf("stages", j.stage),
      j.jobItem, idOf("members", j.assignee),
      j.detail ?? null, j.remarks ?? null, j.progress,
      j.startDate, j.endDate, j.archived ? 1 : 0
    );
  }
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

console.log(`Selesai: ${jobs.length} job dan ${members.length} member masuk ke ${file}`);