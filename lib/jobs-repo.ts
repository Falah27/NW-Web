import { getDb } from "./db";
import type { Job, Member } from "./types";
import { randomUUID } from "node:crypto";
import { isValidSotNo } from "./sot";

interface JobRow {
  id: string;
  model: string;
  module: string | null;
  stage: string | null;
  job_item: string;
  assignee: string | null;
  detail_job: string | null;
  remarks: string | null;
  sot_no: string | null;
  sot_status: string | null;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  is_archived: number;
}

interface MemberRow {
  id: number;
  name: string;
  role: string;
  skills: string;
  email: string | null;
}

// Alamat dasar SOT dibaca dari .env.local (SOT_BASE_URL), bukan ditulis di kode.
function buildSotUrl(sotNo: string | null): string | undefined {
  const base = process.env.SOT_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base || !sotNo || !isValidSotNo(sotNo)) return undefined;
  return `${base}/${sotNo}`;
}

export function getJobs(): Job[] {
  const rows = getDb()
    .prepare(
      `SELECT j.id, mg.name AS model, m.name AS module, s.name AS stage,
              j.job_item, a.name AS assignee, j.detail_job, j.remarks,
              j.sot_no, j.sot_status, j.progress, j.start_date, j.end_date, j.is_archived
       FROM jobs j
       JOIN model_groups mg ON mg.id = j.model_group_id
       LEFT JOIN modules m ON m.id = j.module_id
       LEFT JOIN stages s ON s.id = j.stage_id
       LEFT JOIN members a ON a.id = j.assignee_id
       ORDER BY mg.id, j.start_date`
    )
    .all() as unknown as JobRow[];

  return rows.map((r) => ({
    id: r.id,
    model: r.model,
    module: r.module ?? "",
    stage: r.stage ?? "",
    jobItem: r.job_item,
    assignee: r.assignee ?? "",
    detail: r.detail_job ?? undefined,
    remarks: r.remarks ?? undefined,
    sotNo: r.sot_no ?? undefined,
    sotUrl: buildSotUrl(r.sot_no),
    sotStatus: r.sot_status ?? undefined,
    progress: r.progress,
    startDate: r.start_date,
    endDate: r.end_date,
    archived: r.is_archived === 1,
  }));
}

export function getMembers(): Member[] {
  const rows = getDb()
    .prepare("SELECT id, name, role, skills, email FROM members ORDER BY id")
    .all() as unknown as MemberRow[];

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    role: r.role,
    skills: JSON.parse(r.skills) as string[],
    email: r.email ?? undefined,
  }));
}

export interface JobInput {
  model: string;
  module: string;
  stage: string;
  jobItem: string;
  assignee: string;
  detail: string;
  remarks: string;
  sotNo: string;
  sotStatus: string;
  progress: number; // 0 sampai 1
  startDate: string | null;
  endDate: string | null;
}

function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function lookupId(table: "model_groups" | "modules" | "stages", name: string): number | null {
  if (!name) return null;
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name);
  return (db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as { id: number }).id;
}

function memberIdByName(name: string): number {
  const row = getDb().prepare("SELECT id FROM members WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`PIC "${name}" tidak ditemukan di tabel member.`);
  return row.id;
}

export function createJob(input: JobInput): string {
  return tx(() => {
    const id = `manual-${randomUUID()}`;
    getDb()
      .prepare(
        `INSERT INTO jobs (id, sot_no, sot_status, model_group_id, module_id, stage_id,
           job_item, assignee_id, detail_job, remarks, progress, start_date, end_date, is_archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .run(
        id,
        input.sotNo || null,
        input.sotStatus || null,
        lookupId("model_groups", input.model),
        lookupId("modules", input.module),
        lookupId("stages", input.stage),
        input.jobItem,
        memberIdByName(input.assignee),
        input.detail || null,
        input.remarks || null,
        input.progress,
        input.startDate,
        input.endDate
      );
    return id;
  });
}

export function updateJob(id: string, input: JobInput): void {
  tx(() => {
    const result = getDb()
      .prepare(
        `UPDATE jobs SET sot_no = ?, sot_status = ?, model_group_id = ?, module_id = ?,
           stage_id = ?, job_item = ?, assignee_id = ?, detail_job = ?, remarks = ?,
           progress = ?, start_date = ?, end_date = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        input.sotNo || null,
        input.sotStatus || null,
        lookupId("model_groups", input.model),
        lookupId("modules", input.module),
        lookupId("stages", input.stage),
        input.jobItem,
        memberIdByName(input.assignee),
        input.detail || null,
        input.remarks || null,
        input.progress,
        input.startDate,
        input.endDate,
        id
      );
    if (Number(result.changes) === 0) throw new Error("Job tidak ditemukan.");
  });
}

export function deleteJob(id: string): void {
  const result = getDb().prepare("DELETE FROM jobs WHERE id = ?").run(id);
  if (Number(result.changes) === 0) throw new Error("Job tidak ditemukan.");
}