import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { buildIssuesApiUrl, fetchAllIssues, normalizeIssue, parseFieldIds, parseQuery, SotApiError } from "../lib/sot-issues-api.ts";

const KEY = "rahasia-api-key-123";

function cfg(baseUrl, extra = {}) {
  return { baseUrl, apiKey: KEY, project: "fwdesign", query: "status_id=open&cf_3=659&cf_4=639", fieldIds: [1, 6, 5], timeoutMs: 2000, ...extra };
}

// Server SOT tiruan. `handler(req, res, url)` bebas diatur per tes; `seen` mencatat permintaan yang masuk.
async function withServer(handler, run) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    seen.push({ path: url.pathname, params: url.searchParams, key: req.headers["x-redmine-api-key"] });
    handler(req, res, url, seen);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await run(`http://127.0.0.1:${server.address().port}/redmine2/sot`, seen);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

const json = (res, body, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const issue = (id, extra = {}) => ({
  id,
  project: { id: 1, name: "Lucida2-FJX" },
  tracker: { id: 1, name: "Requirement" },
  status: { id: 2, name: "Implementation" },
  subject: `Subject ${id}`,
  assigned_to: { id: 5, name: "Gintara Nandiwardhana" },
  updated_on: "2026-11-09T05:05:00Z",
  custom_fields: [
    { id: 1, name: "Model", value: "Linus2" },
    { id: 6, name: "Tags", value: ["A", "B", ""] },
    { id: 5, name: "Owner", value: null },
    { id: 99, name: "Tidak diminta", value: "x" },
  ],
  ...extra,
});

test("parseFieldIds & parseQuery: validasi", () => {
  assert.deepEqual(parseFieldIds("1, 6 9,6"), [1, 6, 9]);
  assert.deepEqual(parseFieldIds(""), []);
  assert.throws(() => parseFieldIds("1,abc"), SotApiError);
  assert.equal(parseQuery("?status_id=open&cf_3=659").get("cf_3"), "659");
  assert.equal(parseQuery("f[]=status_id&op[status_id]=o").get("op[status_id]"), "o");
  assert.throws(() => parseQuery("limit=5"), /tidak boleh/);
  assert.throws(() => parseQuery("key=abc"), /tidak boleh/);
  assert.throws(() => parseQuery("a b=1"), /karakter/);
});

test("buildIssuesApiUrl: project, filter, urutan tetap, limit 100, offset", () => {
  const url = new URL(buildIssuesApiUrl(cfg("https://h/redmine2/sot/"), 200));
  assert.equal(url.pathname, "/redmine2/sot/issues.json");
  const p = url.searchParams;
  assert.equal(p.get("project_id"), "fwdesign");
  assert.equal(p.get("status_id"), "open");
  assert.equal(p.get("cf_3"), "659");
  assert.equal(p.get("cf_4"), "639");
  assert.equal(p.get("sort"), "id:desc");
  assert.equal(p.get("limit"), "100");
  assert.equal(p.get("offset"), "200");
  assert.equal(p.has("key"), false); // API key tidak boleh ada di URL
  assert.equal(new URL(buildIssuesApiUrl(cfg("https://h/x", { project: "" }), 0)).searchParams.has("project_id"), false);
});

test("normalizeIssue: nilai custom field digabung, kosong jadi '', nama dikumpulkan, yang tak diminta dibuang", () => {
  const names = {};
  const n = normalizeIssue(issue(7), [1, 6, 5], names);
  assert.equal(n.id, 7);
  assert.equal(n.tracker, "Requirement");
  assert.equal(n.assignedTo, "Gintara Nandiwardhana");
  assert.equal(n.project, "Lucida2-FJX");
  assert.deepEqual(n.fields, { 1: "Linus2", 6: "A, B", 5: "" });
  assert.deepEqual(names, { 1: "Model", 6: "Tags", 5: "Owner" });
  assert.equal(normalizeIssue({ subject: "tanpa id" }, [], {}), null);
  const sparse = normalizeIssue({ id: 3, subject: "x" }, [1], {}); // tanpa assigned_to / fixed_version / custom_fields
  assert.equal(sparse.assignedTo, "");
  assert.equal(sparse.fixedVersion, "");
});

test("fetchAllIssues: semua halaman dibaca (server membalas lebih sedikit dari limit) dan API key dikirim lewat header", async () => {
  const all = [issue(5), issue(4), issue(3), issue(2), issue(1)];
  await withServer(
    (req, res, url) => {
      const offset = Number(url.searchParams.get("offset"));
      json(res, { issues: all.slice(offset, offset + 2), total_count: 5, offset, limit: 100 }); // 2 per halaman walau diminta 100
    },
    async (base, seen) => {
      const r = await fetchAllIssues(cfg(base));
      assert.equal(r.totalCount, 5);
      assert.equal(r.pages, 3);
      assert.deepEqual(r.issues.map((i) => i.id).sort(), [1, 2, 3, 4, 5]);
      assert.deepEqual(r.fieldNames, { 1: "Model", 6: "Tags", 5: "Owner" });
      assert.deepEqual(seen.map((s) => s.params.get("offset")), ["0", "2", "4"]);
      assert.ok(seen.every((s) => s.key === KEY && s.params.get("project_id") === "fwdesign"));
    }
  );
});

test("fetchAllIssues: data bergeser saat dibaca (issue terlewat) dibatalkan, bukan dianggap lengkap", async () => {
  // Halaman ke-2 mengulang issue 4 karena ada yang bergeser, sehingga issue 1 tidak pernah terbaca.
  const pages = { 0: [issue(5), issue(4)], 2: [issue(4), issue(3)], 4: [issue(2)] };
  await withServer(
    (req, res, url) => json(res, { issues: pages[Number(url.searchParams.get("offset"))] ?? [], total_count: 5 }),
    async (base) => {
      await assert.rejects(fetchAllIssues(cfg(base)), (e) => e instanceof SotApiError && /berubah saat dibaca/.test(e.message));
    }
  );
});

test("fetchAllIssues: nol issue itu valid", async () => {
  await withServer((req, res) => json(res, { issues: [], total_count: 0, offset: 0, limit: 100 }), async (base) => {
    const r = await fetchAllIssues(cfg(base));
    assert.deepEqual(r.issues, []);
    assert.equal(r.pages, 1);
  });
});

test("fetchAllIssues: kegagalan di halaman ke-2 membatalkan semuanya (tidak ada hasil setengah jadi)", async () => {
  await withServer(
    (req, res, url) =>
      Number(url.searchParams.get("offset")) === 0 ? json(res, { issues: [issue(2), issue(1)], total_count: 4 }) : json(res, {}, 500),
    async (base) => {
      await assert.rejects(fetchAllIssues(cfg(base)), /HTTP 500/);
    }
  );
});

test("fetchAllIssues: pesan error jelas per status HTTP dan tidak pernah memuat API key", async () => {
  const cases = [[401, /API key ditolak/], [403, /Akses ditolak/], [404, /tidak ditemukan/], [422, /filter/]];
  for (const [status, pattern] of cases) {
    await withServer((req, res) => json(res, { errors: ["x"] }, status), async (base) => {
      await assert.rejects(fetchAllIssues(cfg(base)), (e) => e instanceof SotApiError && pattern.test(e.message) && !e.message.includes(KEY));
    });
  }
});

test("fetchAllIssues: pengalihan (login) ditolak dan API key tidak ikut ke alamat lain", async () => {
  let leaked = false;
  const other = http.createServer((req) => {
    if (req.headers["x-redmine-api-key"]) leaked = true;
  });
  await new Promise((r) => other.listen(0, "127.0.0.1", r));
  try {
    await withServer(
      (req, res) => {
        res.writeHead(302, { location: `http://127.0.0.1:${other.address().port}/login` });
        res.end();
      },
      async (base) => {
        await assert.rejects(fetchAllIssues(cfg(base)), /mengalihkan/);
      }
    );
    assert.equal(leaked, false);
  } finally {
    other.closeAllConnections?.();
    await new Promise((r) => other.close(r));
  }
});

test("fetchAllIssues: balasan 200 yang bukan JSON atau bukan format Redmine ditolak", async () => {
  await withServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<html>Login</html>"); }, async (base) => {
    await assert.rejects(fetchAllIssues(cfg(base)), /bukan JSON/);
  });
  await withServer((req, res) => json(res, { hello: "world" }), async (base) => {
    await assert.rejects(fetchAllIssues(cfg(base)), /tidak dikenali/);
  });
});

test("fetchAllIssues: timeout dilaporkan dengan petunjuk", async () => {
  await withServer(() => { /* tidak pernah menjawab */ }, async (base) => {
    await assert.rejects(fetchAllIssues(cfg(base, { timeoutMs: 100 })), /tidak menjawab dalam/);
  });
});

test("fetchAllIssues: server tidak bisa dihubungi dan masalah sertifikat dijelaskan", async () => {
  await assert.rejects(fetchAllIssues(cfg("http://127.0.0.1:1/redmine2/sot")), /Tidak bisa terhubung|Gagal menghubungi/);
  const certError = Object.assign(new TypeError("fetch failed"), { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } });
  await assert.rejects(fetchAllIssues(cfg("https://h/x"), async () => { throw certError; }), /NODE_EXTRA_CA_CERTS/);
});
