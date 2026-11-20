import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysISO,
  diffDaysISO,
  isValidISODate,
  parseISODate,
  toISODate,
} from "./dates.ts";

test("addDaysISO crosses month and year boundaries", () => {
  assert.equal(addDaysISO("2026-11-20", 1), "2026-11-21");
  assert.equal(addDaysISO("2026-01-31", 1), "2026-02-01");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
});

test("addDaysISO supports leap and non-leap years", () => {
  assert.equal(addDaysISO("2024-02-28", 1), "2024-02-29");
  assert.equal(addDaysISO("2024-02-29", 1), "2024-03-01");
  assert.equal(addDaysISO("2025-02-28", 1), "2025-03-01");
});

test("isValidISODate rejects impossible calendar dates", () => {
  assert.equal(isValidISODate("2026-02-31"), false);
  assert.equal(isValidISODate("2026-04-31"), false);
  assert.equal(isValidISODate("2023-02-29"), false);
  assert.equal(isValidISODate("1900-02-29"), false);
  assert.equal(isValidISODate("2026-13-01"), false);
  assert.equal(isValidISODate("2026-00-10"), false);
  assert.equal(isValidISODate("2026-1-01"), false);
  assert.equal(isValidISODate(null), false);
});

test("isValidISODate accepts real dates", () => {
  assert.equal(isValidISODate("2024-02-29"), true);
  assert.equal(isValidISODate("2000-02-29"), true);
  assert.equal(isValidISODate("2026-11-20"), true);
});

test("parseISODate and toISODate round trip local date components", () => {
  assert.equal(toISODate(parseISODate("2026-11-20")), "2026-11-20");
});

test("diffDaysISO uses calendar-day difference", () => {
  assert.equal(diffDaysISO("2026-11-20", "2026-11-21"), 1);
  assert.equal(diffDaysISO("2026-12-31", "2027-01-01"), 1);
});
