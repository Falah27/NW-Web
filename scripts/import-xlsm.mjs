import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";
import { DatabaseSync } from "node:sqlite";

const workbookPath = process.argv[2];
const sheetName = process.argv[3] ?? "Job_Follow_Up";

if (!workbookPath) {
  throw new Error(
    'Usage: npm run import:xlsm -- "C:\\path\\New_NW_Job_Follow_Up_Sheet_FY26.xlsm" [sheet]'
  );
}
if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found: ${workbookPath}`);
}

const workbook = XLSX.readFile(workbookPath, {
  cellDates: true,
  cellFormula: false,
  cellNF: false,
  cellStyles: false,
  bookVBA: true,
});
const sheet = workbook.Sheets[sheetName];
if (!sheet) {
  throw new Error(
    `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(", ")}`
  );
}

const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: null,
  raw: true,
});
const headerRowIndex = rows.findIndex((row) =>
  row.some((value) => normalize(value) === "job items")
);
if (headerRowIndex < 0) {
  throw new Error(`Could not find the job table header in sheet "${sheetName}"`);
}

const headers = rows[headerRowIndex].map(normalize);
const column = (aliases, required = false) => {
  const index = headers.findIndex((header) => aliases.includes(header));
  if (required && index < 0) {
    throw new Error(`Required column missing: ${aliases[0]}`);
  }
  return index;
};

const columns = {
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

const dataRows = rows.slice(headerRowIndex + 1);
const jobs = [];
for (let offset = 0; offset < dataRows.length; offset += 1) {
  const row = dataRows[offset];
  const model = text(row[columns.model]);
  const jobItem = text(row[columns.jobItem]);
  const assignee = text(row[columns.assignee]);
  if (!model || !jobItem || !assignee) {
    continue;
  }

  const excelRow = headerRowIndex + offset + 2;
  const employeeId = assignee.match(/\b(iei\d+)\b/i)?.[1]?.toLowerCase() ?? null;
  const memberName = assignee.replace(/\s+\biei\d+\b/i, "").trim();
  jobs.push({
    id: `excel-${excelRow}`,
    excelRow,
    model,
    module: text(row[columns.module]),
    stage: text(row[columns.stage]),
    jobItem,
    assignee: memberName || assignee,
    employeeId,
    detail: text(row[columns.detail]),
    remarks: text(row[columns.remarks]),
    sotNo: text(row[columns.sotNo]),
    sotStatus: text(row[columns.sotStatus]),
    progress: numberBetweenZeroAndOne(row[columns.progress]),
    startDate: dateValue(row[columns.startDate]),
    endDate: dateValue(row[columns.endDate]),
    archived: isHiddenRow(sheet, excelRow),
  });
}

if (jobs.length === 0) {
  throw new Error(`No importable job rows found in sheet "${sheetName}"`);
}

const dbPath = path.join(process.cwd(), "data", "dev.db");
if (!fs.existsSync(dbPath)) {
  throw new Error(`Database not found: ${dbPath}. Run "npm run db:init" first.`);
}
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");

const requiredTables = ["members", "model_groups", "modules", "stages", "jobs"];
for (const table of requiredTables) {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  if (!exists) {
    throw new Error(`Database table "${table}" is missing. Run "npm run db:init" first.`);
  }
}

const getOrCreate = (table, name, extraColumn = null, extraValue = null) => {
  if (!name) return null;
  if (extraColumn) {
    db.prepare(
      `INSERT INTO ${table} (name, ${extraColumn}) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET ${extraColumn}=COALESCE(excluded.${extraColumn}, ${table}.${extraColumn})`
    ).run(name, extraValue);
  } else {
    db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name);
  }
  return db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name).id;
};

db.exec("BEGIN IMMEDIATE");
try {
  db.exec("DELETE FROM jobs; DELETE FROM model_groups; DELETE FROM modules; DELETE FROM stages;");

  const insertJob = db.prepare(`
    INSERT INTO jobs (
      id, sot_no, sot_status, model_group_id, module_id, stage_id, job_item,
      assignee_id, detail_job, remarks, progress, start_date, end_date,
      is_archived, excel_row_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const job of jobs) {
    const memberId = getOrCreate("members", job.assignee, "employee_id", job.employeeId);
    insertJob.run(
      job.id,
      job.sotNo,
      job.sotStatus,
      getOrCreate("model_groups", job.model),
      getOrCreate("modules", job.module),
      getOrCreate("stages", job.stage),
      job.jobItem,
      memberId,
      job.detail,
      job.remarks,
      job.progress,
      job.startDate,
      job.endDate,
      job.archived ? 1 : 0,
      String(job.excelRow)
    );
  }
  db.exec(`
    DELETE FROM model_groups WHERE id NOT IN (SELECT model_group_id FROM jobs);
    DELETE FROM modules WHERE id NOT IN (SELECT module_id FROM jobs WHERE module_id IS NOT NULL);
    DELETE FROM stages WHERE id NOT IN (SELECT stage_id FROM jobs WHERE stage_id IS NOT NULL);
  `);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(
  `Imported ${jobs.length} jobs from ${path.basename(workbookPath)} / ${sheetName}`
);

function normalize(value) {
  return text(value)?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function text(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

function numberBetweenZeroAndOne(value) {
  if (typeof value === "number") {
    return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
  }
  const parsed = Number.parseFloat(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function isHiddenRow(worksheet, rowNumber) {
  return Boolean(worksheet["!rows"]?.[rowNumber - 1]?.hidden);
}
