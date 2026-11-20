import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCategoryInput,
  validateCategoryName,
  validateId,
  validateMilestoneInput,
  validateModelName,
} from "./roadmap-validation.ts";

test("validates and normalizes model and category names", () => {
  assert.deepEqual(validateModelName("  Linus2  "), { ok: true, value: "Linus2" });
  assert.equal(validateModelName(" ").ok, false);
  assert.equal(validateModelName("x".repeat(81)).ok, false);
  assert.deepEqual(validateCategoryName(" Release "), { ok: true, value: "Release" });
  assert.equal(validateCategoryInput({ name: "Release", color: "#aBc123" }).ok, true);
  assert.equal(validateCategoryInput({ name: "Release", color: "red" }).ok, false);
});

test("validates positive integer IDs", () => {
  assert.deepEqual(validateId(5), { ok: true, value: 5 });
  assert.equal(validateId(0).ok, false);
  assert.equal(validateId(1.5).ok, false);
  assert.equal(validateId("1").ok, false);
});

test("validates milestone text and real calendar dates", () => {
  assert.deepEqual(
    validateMilestoneInput({
      modelId: 1,
      categoryId: 2,
      title: "  SDR1  ",
      start: "2026-02-28",
      end: "2026-03-01",
    }),
    {
      ok: true,
      value: {
        modelId: 1,
        categoryId: 2,
        title: "SDR1",
        start: "2026-02-28",
        end: "2026-03-01",
      },
    }
  );
  assert.equal(
    validateMilestoneInput({
      modelId: 1,
      categoryId: 2,
      title: "SDR1",
      start: "2026-02-31",
      end: "2026-03-01",
    }).ok,
    false
  );
});

test("rejects reversed and overlong milestone ranges", () => {
  const base = { modelId: 1, categoryId: 1, title: "Milestone" };
  assert.equal(
    validateMilestoneInput({ ...base, start: "2026-03-02", end: "2026-03-01" }).ok,
    false
  );
  assert.equal(
    validateMilestoneInput({ ...base, start: "2026-01-01", end: "2029-01-01" }).ok,
    false
  );
});
