import test from "node:test";
import assert from "node:assert/strict";
import { backoffMs, readAllWithRetry, readIntEnv } from "./sot/retry.mjs";

const fys = (labels) => labels.map((label) => ({ label, link: `https://sot.test/${label}` }));
const run = (labels, readOne, options = {}) => {
  const sleeps = [];
  const warnings = [];
  return readAllWithRetry({
    fys: fys(labels),
    readOne,
    retries: 2,
    sleep: async (ms) => sleeps.push(ms),
    onWarn: (message) => warnings.push(message),
    ...options,
  }).then((results) => ({ results, sleeps, warnings }));
};

test("semua FY berhasil tanpa retry", async () => {
  let calls = 0;
  const { results, sleeps, warnings } = await run(["FY18", "FY19"], async (fy) => {
    calls += 1;
    return { status: "ok", projects: [{ name: fy.label }] };
  });
  assert.equal(calls, 2);
  assert.equal(results.every((result) => result.status === "ok"), true);
  assert.deepEqual(sleeps, []);
  assert.deepEqual(warnings, []);
});

test("FY gagal lalu berhasil pada percobaan kedua", async () => {
  let calls = 0;
  const { results, sleeps } = await run(["FY18"], async () => {
    calls += 1;
    return calls === 1 ? { status: "error", message: "timeout" } : { status: "ok" };
  });
  assert.equal(calls, 2);
  assert.equal(results[0].status, "ok");
  assert.deepEqual(sleeps, [5000]);
});

test("FY gagal terus berhenti setelah retries + 1 percobaan", async () => {
  let calls = 0;
  const { results } = await run(["FY18"], async () => {
    calls += 1;
    return { status: "error", message: "jaringan gagal" };
  });
  assert.equal(calls, 3);
  assert.equal(results[0].status, "error");
  assert.equal(results[0].attempts, 3);
});

test("status non-retryable tidak diulang", async () => {
  for (const result of [
    { status: "unexpected" },
    { status: "noproject" },
    { status: "http", code: 404 },
  ]) {
    let calls = 0;
    const runResult = await run(["FY18"], async () => {
      calls += 1;
      return result;
    });
    assert.equal(calls, 1);
    assert.equal(runResult.results[0].status, result.status);
  }
});

test("FY yang sudah ok tidak dibaca ulang", async () => {
  const calls = new Map();
  const { results } = await run(["FY18", "FY19"], async (fy) => {
    calls.set(fy.label, (calls.get(fy.label) ?? 0) + 1);
    return { status: "ok" };
  });
  assert.deepEqual(Object.fromEntries(calls), { FY18: 1, FY19: 1 });
  assert.equal(results.length, 2);
});

test("pemutus berantai menandai sisa FY sebagai skipped", async () => {
  const calls = [];
  const { results } = await run(["FY18", "FY19", "FY20", "FY21"], async (fy) => {
    calls.push(fy.label);
    return { status: "error", message: "server sibuk" };
  });
  assert.deepEqual(calls, ["FY18", "FY18", "FY18", "FY19", "FY19", "FY19", "FY20", "FY20", "FY20"]);
  assert.deepEqual(results.map((result) => result.status), ["error", "error", "error", "skipped"]);
  assert.match(results[3].message, /3 FY berturut-turut gagal/);
});

test("readIntEnv memakai default atau nilai valid", () => {
  const options = { def: 120000, min: 10000, max: 600000 };
  assert.equal(readIntEnv("", options), 120000);
  assert.equal(readIntEnv("abc", options), 120000);
  assert.equal(readIntEnv("-1", options), 120000);
  assert.equal(readIntEnv("9999", options), 120000);
  assert.equal(readIntEnv("600001", options), 120000);
  assert.equal(readIntEnv("180000", options), 180000);
});

test("backoffMs memakai backoff eksponensial berbasis tiga", () => {
  assert.equal(backoffMs(1), 5000);
  assert.equal(backoffMs(2), 15000);
  assert.equal(backoffMs(3), 45000);
});
