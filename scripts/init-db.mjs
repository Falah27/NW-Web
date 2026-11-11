import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../lib/migrations.ts";
import { jobs } from "../lib/mock-data.ts";
import { members } from "../lib/mock-members.ts";

const force = process.argv.includes("--force");
const seedDemo = process.argv.includes("--seed-demo");
const dir = path.join(process.cwd(), "data");
const file = path.resolve(process.env.DATABASE_PATH ?? path.join(dir, "dev.db"));

fs.mkdirSync(path.dirname(file), { recursive: true });
if (fs.existsSync(file) && !force) {
  throw new Error(`Database already exists at ${file}. Use --force only if you intend to replace it.`);
}
if (force && fs.existsSync(file)) fs.rmSync(file);

const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
runMigrations(db);

if (seedDemo) {
  const idOf = (table, name) => {
    if (!name) return null;
    db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name);
    return db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name).id;
  };
  db.exec("BEGIN");
  try {
    const insMember = db.prepare("INSERT OR IGNORE INTO members (name, role, skills, email) VALUES (?, ?, ?, ?)");
    for (const member of members) insMember.run(member.name, member.role, JSON.stringify(member.skills), member.email ?? null);
    const insJob = db.prepare(`
      INSERT INTO jobs (id, sot_no, sot_status, model_group_id, module_id, stage_id, job_item, assignee_id, detail_job, remarks, progress, start_date, end_date, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const job of jobs) {
      insJob.run(
        job.id, job.sotNo ?? null, job.sotStatus ?? null, idOf("model_groups", job.model),
        idOf("modules", job.module), idOf("stages", job.stage), job.jobItem, idOf("members", job.assignee),
        job.detail ?? null, job.remarks ?? null, job.progress, job.startDate, job.endDate, job.archived ? 1 : 0
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

console.log(`Database siap di ${file}${seedDemo ? ` (${jobs.length} demo job, ${members.length} demo member)` : ""}.`);
db.close();
