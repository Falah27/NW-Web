import { getDb } from "./db";
import type { Job, Member } from "./types";

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