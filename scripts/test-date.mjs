import test from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, diffDaysISO, todayISO } from "../lib/date.ts";

test("addDaysISO: lintas akhir bulan dan tahun", () => {
  assert.equal(addDaysISO("2026-11-18", 1), "2026-11-19");
  assert.equal(addDaysISO("2026-01-31", 1), "2026-02-01");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2027-01-01", -1), "2026-12-31");
});

test("diffDaysISO: berbasis UTC", () => {
  assert.equal(diffDaysISO("2026-12-31", "2027-01-01"), 1);
  assert.equal(diffDaysISO("2027-01-01", "2026-12-31"), -1);
});

test("todayISO: instan 17:30Z adalah tanggal berikutnya di WIB", () => {
  assert.equal(todayISO("Asia/Jakarta", new Date("2026-11-10T17:30:00Z")), "2026-11-11");
});
