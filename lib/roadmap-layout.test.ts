import test from "node:test";
import assert from "node:assert/strict";
import { dueStatus, getMonthSegments, layoutRow } from "./roadmap-layout.ts";

test("getMonthSegments groups consecutive days into calendar months", () => {
  assert.deepEqual(getMonthSegments("2026-01-30", 5), [
    { startIso: "2026-01-30", label: "January 2026", count: 2 },
    { startIso: "2026-02-01", label: "February 2026", count: 3 },
  ]);
  assert.deepEqual(getMonthSegments("2026-01-01", 0), []);
});

test("layoutRow clips milestones on the left and right edges", () => {
  const result = layoutRow(
    [
      { id: 1, start: "2026-11-08", end: "2026-11-11" },
      { id: 2, start: "2026-11-13", end: "2026-11-16" },
    ],
    "2026-11-10",
    5
  );
  assert.deepEqual(result.items, [
    {
      id: 1,
      lane: 0,
      offsetDays: 0,
      spanDays: 2,
      clippedLeft: true,
      clippedRight: false,
    },
    {
      id: 2,
      lane: 0,
      offsetDays: 3,
      spanDays: 2,
      clippedLeft: false,
      clippedRight: true,
    },
  ]);
});

test("layoutRow ignores milestones completely outside the visible range", () => {
  const result = layoutRow(
    [
      { id: 1, start: "2026-11-01", end: "2026-11-02" },
      { id: 2, start: "2026-11-20", end: "2026-11-21" },
    ],
    "2026-11-10",
    5
  );
  assert.deepEqual(result.items, []);
  assert.equal(result.laneCount, 1);
  assert.equal(result.rowHeight, 34);
});

test("overlapping milestones use separate lanes", () => {
  const result = layoutRow(
    [
      { id: 1, start: "2026-11-10", end: "2026-11-13" },
      { id: 2, start: "2026-11-12", end: "2026-11-15" },
      { id: 3, start: "2026-11-13", end: "2026-11-17" },
    ],
    "2026-11-10",
    10
  );
  assert.deepEqual(result.items.map((item) => item.lane), [0, 1, 2]);
  assert.equal(result.laneCount, 3);
  assert.equal(result.rowHeight, 86);
});

test("non-overlapping milestones share a lane", () => {
  const result = layoutRow(
    [
      { id: 1, start: "2026-11-10", end: "2026-11-11" },
      { id: 2, start: "2026-11-12", end: "2026-11-13" },
      { id: 3, start: "2026-11-14", end: "2026-11-15" },
    ],
    "2026-11-10",
    10
  );
  assert.deepEqual(result.items.map((item) => item.lane), [0, 0, 0]);
  assert.equal(result.laneCount, 1);
  assert.equal(result.rowHeight, 34);
});

test("lane assignments remain stable when the visible period moves", () => {
  const milestones = [
    { id: 1, start: "2026-11-10", end: "2026-11-15" },
    { id: 2, start: "2026-11-12", end: "2026-11-14" },
    { id: 3, start: "2026-11-16", end: "2026-11-20" },
  ];
  const original = layoutRow(milestones, "2026-11-10", 8);
  const shifted = layoutRow(milestones, "2026-11-12", 8);
  const lanes = (result: typeof original) =>
    new Map(result.items.map((item) => [item.id, item.lane]));

  assert.deepEqual([...lanes(shifted)], [...lanes(original)]);
});

test("dueStatus reports future, due-today, and overdue milestones", () => {
  assert.equal(dueStatus("2026-11-23", "2026-11-20"), "Jatuh tempo 3 hari lagi");
  assert.equal(dueStatus("2026-11-20", "2026-11-20"), "Jatuh tempo hari ini");
  assert.equal(dueStatus("2026-11-17", "2026-11-20"), "Terlambat 3 hari");
});
