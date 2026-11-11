import * as XLSX from "xlsx";
import { getDb } from "./db";

export interface ImportResult {
  count: number;
  archived: number;
}

export interface LastSync {
  at: string;
  file: string;
  sheet: string;
  count: number;
}

type LookupTable = "members" | "model_groups" | "modules" | "stages";

interface ParsedJob {
  id: string;
  excelRow: number;
  model: string;
  module: string | null;
  stage: string | null;
  jobItem: string;
  assignee: string;
  employeeId: string | null;
  detail: string | null;
  remarks: string | null;
  sotNo: string | null;
  sotStatus: string | null;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  archived: boolean;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

function normalize(value: unknown): string {
  return text(value)?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function progressValue(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function dateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1) return null;
    const ms = Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

function parseWorkbook(buffer: Buffer, sheetName: string): { jobs: ParsedJob[] } {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellNF: false,
    cellStyles: true,
  });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(
      `Sheet "${sheetName}" tidak ditemukan. Sheet yang ada: ${workbook.SheetNames.join(", ")}`
    );
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = rows.findIndex((row) => row.some((v) => normalize(v) === "job items"));
  if (headerRowIndex < 0) {
    throw new Error(`Header tabel job ("Job Items") tidak ditemukan di sheet "${sheetName}".`);
  }

  const headers = rows[headerRowIndex].map(normalize);
  const column = (aliases: string[], required = false) => {
    const index = headers.findIndex((h) => aliases.includes(h));
    if (required && index < 0) throw new Error(`Kolom wajib tidak ada: ${aliases[0]}`);
    return index;
  };
  const c = {
    sotNo: column(["sot no"]),
    sotStatus: column(["sot status"]),
    model: column(["model name"], true),
    module: column(["module name"]),
    stage: column(["stage/tracker"]),
    jobItem: column(["job items"], true),
    assignee: column(["assigned to"], true),
    detail: column(["detail job"]),
    remarks: column(["remarks"]),
    progress: column(["progress"]),
    startDate: column(["start date"]),
    endDate: column(["end date"]),
  };
  const at = (row: unknown[], index: number) => (index < 0 ? null : row[index]);

  const jobs: ParsedJob[] = [];
  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const model = text(at(row, c.model));
    const jobItem = text(at(row, c.jobItem));
    const assignee = text(at(row, c.assignee));
    if (!model || !jobItem || !assignee) return;

    const excelRow = headerRowIndex + offset + 2;
    const employeeId = assignee.match(/\b(iei\d+)\b/i)?.[1]?.toLowerCase() ?? null;
    const memberName = assignee.replace(/\s+\biei\d+\b/i, "").trim();
    jobs.push({
      id: `excel-${excelRow}`,
      excelRow,
      model,
      module: text(at(row, c.module)),
      stage: text(at(row, c.stage)),
      jobItem,
      assignee: memberName || assignee,
      employeeId,
      detail: text(at(row, c.detail)),
      remarks: text(at(row, c.remarks)),
      sotNo: text(at(row, c.sotNo)),
      sotStatus: text(at(row, c.sotStatus)),
      progress: progressValue(at(row, c.progress)),
      startDate: dateValue(at(row, c.startDate)),
      endDate: dateValue(at(row, c.endDate)),
      archived: Boolean(sheet["!rows"]?.[excelRow - 1]?.hidden),
    });
  });

  if (jobs.length === 0) throw new Error(`Tidak ada baris job yang bisa diimpor dari sheet "${sheetName}".`);
  return { jobs };
}

function ensureMetaTable() {
  getDb().exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
}

export function getLastSync(): LastSync | null {
  ensureMetaTable();
  const row = getDb().prepare("SELECT value FROM app_meta WHERE key = 'last_sync'").get() as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as LastSync;
  } catch {
    return null;
  }
}

export function importWorkbook(buffer: Buffer, fileName: string, sheetName: string): ImportResult {
  const { jobs } = parseWorkbook(buffer, sheetName);

  ensureMetaTable();
  const db = getDb();
  const getOrCreate = (table: LookupTable, name: string | null, withEmployeeId?: string | null) => {
    if (!name) return null;
    if (table === "members") {
      db.prepare(
        `INSERT INTO members (name, employee_id) VALUES (?, ?)
         ON CONFLICT(name) DO UPDATE SET employee_id = COALESCE(excluded.employee_id, members.employee_id)`
      ).run(name, withEmployeeId ?? null);
    } else {
      db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name);
    }
    return (db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as { id: number }).id;
  };

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM jobs WHERE id NOT LIKE 'manual-%'");
    const insertJob = db.prepare(`
      INSERT INTO jobs (
        id, sot_no, sot_status, model_group_id, module_id, stage_id, job_item,
        assignee_id, detail_job, remarks, progress, start_date, end_date,
        is_archived, excel_row_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const job of jobs) {
      insertJob.run(
        job.id,
        job.sotNo,
        job.sotStatus,
        getOrCreate("model_groups", job.model),
        getOrCreate("modules", job.module),
        getOrCreate("stages", job.stage),
        job.jobItem,
        getOrCreate("members", job.assignee, job.employeeId),
        job.detail,
        job.remarks,
        job.progress,
        job.startDate,
        job.endDate,
        job.archived ? 1 : 0,
        String(job.excelRow)
      );
    }

    // Grup model yang masih dipakai tabel SOT (project member / mapping manual) tidak boleh dihapus,
    // kalau tidak foreign key gagal dan seluruh import di-rollback.
    const tableExists = (name: string) =>
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
    const keepGroups = ["SELECT model_group_id FROM jobs"];
    if (tableExists("sot_project_members")) {
      keepGroups.push("SELECT model_group_id FROM sot_project_members WHERE model_group_id IS NOT NULL");
    }
    if (tableExists("sot_model_mappings")) {
      keepGroups.push("SELECT model_group_id FROM sot_model_mappings");
    }

    db.exec(`
      DELETE FROM model_groups WHERE id NOT IN (${keepGroups.join(" UNION ")});
      DELETE FROM modules WHERE id NOT IN (SELECT module_id FROM jobs WHERE module_id IS NOT NULL);
      DELETE FROM stages WHERE id NOT IN (SELECT stage_id FROM jobs WHERE stage_id IS NOT NULL);
    `);

    const meta: LastSync = { at: new Date().toISOString(), file: fileName, sheet: sheetName, count: jobs.length };
    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('last_sync', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(JSON.stringify(meta));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    if (error instanceof Error && error.message.includes("members.employee_id")) {
      throw new Error("Employee ID yang sama dipakai oleh dua nama member berbeda di Excel.");
    }
    throw error;
  }

  return { count: jobs.length, archived: jobs.filter((j) => j.archived).length };
}
