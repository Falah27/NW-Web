import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import XLSX from "xlsx";
import { parseWorkbook } from "../lib/xlsm-import.ts";

function workbookBuffer(rows, hiddenRows = []) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!rows"] = hiddenRows.map((hidden) => ({ hidden }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Job_Follow_Up");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

const header = [
  "SOT No", "SOT Status", "Model Name", "Module Name", "Stage/Tracker", "Job Items",
  "Assigned To", "Detail Job", "Remarks", "Progress", "Start Date", "End Date",
];

test("parseWorkbook: membaca tanggal, progress, hidden row, dan employee ID", () => {
  const buffer = workbookBuffer([
    header,
    ["1", "Open", "Model A", "Module A", "Stage A", "Job A", "Demo User iei123", "Detail", "Remark", 0.5, 46000, 46001],
  ], [false, true]);
  const result = parseWorkbook(buffer, "Job_Follow_Up");
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].employeeId, "iei123");
  assert.equal(result.jobs[0].assignee, "Demo User");
  assert.equal(result.jobs[0].progress, 0.5);
  assert.equal(result.jobs[0].startDate, "2025-12-09");
  assert.equal(result.jobs[0].archived, true);
});

test("parseWorkbook: menolak file bukan ZIP dan sheet __proto__", () => {
  assert.throws(() => parseWorkbook(Buffer.from("not an xlsx"), "Job_Follow_Up"), /ZIP signature/);
  const buffer = workbookBuffer([header, ["1", "Open", "Model", null, null, "Job", "User", null, null, "50%", null, null]]);
  assert.throws(() => parseWorkbook(buffer, "__proto__"), /tidak ditemukan/);
});

test("parseWorkbook: menolak lebih dari 20.000 baris", () => {
  const rows = [header];
  for (let i = 0; i < 20_001; i += 1) {
    rows.push(["1", "Open", "Model", null, null, `Job ${i}`, "User", null, null, "50%", null, null]);
  }
  const buffer = workbookBuffer(rows);
  assert.throws(() => parseWorkbook(buffer, "Job_Follow_Up"), /20\.000/);
});

test("parseWorkbook: ID stabil, duplikat diberi suffix, dan baris sisipan tidak menggeser ID", () => {
  const first = workbookBuffer([
    header,
    ["1", "Open", "Model A", null, null, "Job A", "User", null, null, "50%", null, null],
    ["2", "Open", "Model B", null, null, "Job B", "User", null, null, "50%", null, null],
    ["2", "Open", "Model B", null, null, "Job B", "User", null, null, "50%", null, null],
  ]);
  const inserted = workbookBuffer([
    header,
    ["1", "Open", "Model A", null, null, "Job A", "User", null, null, "50%", null, null],
    ["9", "Open", "Model X", null, null, "Inserted", "User", null, null, "50%", null, null],
    ["2", "Open", "Model B", null, null, "Job B", "User", null, null, "50%", null, null],
    ["2", "Open", "Model B", null, null, "Job B", "User", null, null, "50%", null, null],
  ]);
  const a = parseWorkbook(first, "Job_Follow_Up").jobs;
  const b = parseWorkbook(inserted, "Job_Follow_Up").jobs;
  assert.equal(a[1].id, b[2].id);
  assert.equal(a[2].id, b[3].id);
  assert.match(a[2].id, /#2$/);
});

test("importWorkbook: impor ulang memperbarui dan edit lokal dilewati", async () => {
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "team-hub-import-")), "test.db");
  process.env.DATABASE_PATH = databasePath;
  const { runMigrations } = await import("../lib/migrations.ts");
  const db = new DatabaseSync(databasePath);
  runMigrations(db);
  db.exec("INSERT INTO model_groups (name) VALUES ('Model A'); INSERT INTO members (name) VALUES ('User');");
  const { importWorkbook } = await import("../lib/xlsm-import.ts");
  const { updateJob } = await import("../lib/jobs-repo.ts");
  const buffer = workbookBuffer([
    header,
    ["1", "Open", "Model A", null, null, "Job A", "User", "Detail", null, "50%", null, null],
  ]);
  assert.equal(importWorkbook(buffer, "test.xlsx", "Job_Follow_Up").added, 1);
  assert.equal(importWorkbook(buffer, "test.xlsx", "Job_Follow_Up").updated, 1);
  updateJob("excel-".concat(parseWorkbook(buffer, "Job_Follow_Up").jobs[0].id.split("excel-")[1]), {
    sotNo: "1", sotStatus: "Open", model: "Model A", module: "", stage: "", jobItem: "Edited",
    assignee: "User", detail: "Local", remarks: "", progress: 0.8, startDate: null, endDate: null,
  });
  assert.equal(importWorkbook(buffer, "test.xlsx", "Job_Follow_Up").skippedLocal, 1);
  db.close();
});
