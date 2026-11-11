import test from "node:test";
import assert from "node:assert/strict";
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
