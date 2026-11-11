import test from "node:test";
import assert from "node:assert/strict";
import { buildIssuesUrl, narrowFysByIssues, projectKey, selectFys } from "./sot/team-filter.mjs";

const BASE = "https://sot.example.net/redmine2/sot/projects/fy26";

test("buildIssuesUrl: filter Team Leader, status open default, kolom Project, 100 per halaman", () => {
  const url = new URL(buildIssuesUrl(BASE + "/", { leaderField: "cf_3", leaderId: "659" }));
  assert.equal(url.pathname, "/redmine2/sot/projects/fy26/issues");
  const p = url.searchParams;
  assert.equal(p.get("set_filter"), "1");
  assert.deepEqual(p.getAll("f[]"), ["status_id", "cf_3"]);
  assert.equal(p.get("op[status_id]"), "o");
  assert.equal(p.get("op[cf_3]"), "=");
  assert.deepEqual(p.getAll("v[cf_3][]"), ["659"]);
  assert.deepEqual(p.getAll("c[]"), ["project"]);
  assert.equal(p.get("per_page"), "100");
});

test("buildIssuesUrl: status all memakai operator '*'", () => {
  const url = new URL(buildIssuesUrl(BASE, { leaderId: "659", status: "all" }));
  assert.equal(url.searchParams.get("op[status_id]"), "*");
  assert.equal(url.searchParams.get("op[cf_3]"), "=");
});

test("buildIssuesUrl: query lama di link FY dibuang, field custom lain didukung", () => {
  const url = new URL(buildIssuesUrl(BASE + "?foo=1#x", { leaderField: "cf_12", leaderId: 7 }));
  assert.equal(url.searchParams.get("foo"), null);
  assert.equal(url.hash, "");
  assert.deepEqual(url.searchParams.getAll("v[cf_12][]"), ["7"]);
});

test("projectKey: path tanpa garis miring akhir", () => {
  assert.equal(projectKey("https://h/redmine2/sot/projects/abc/"), "/redmine2/sot/projects/abc");
  assert.equal(projectKey("https://h/redmine2/sot/projects/abc?x=1"), "/redmine2/sot/projects/abc");
});

const fys = [
  {
    label: "FY26",
    link: "https://h/redmine2/sot/projects/fy26",
    projects: [
      { name: "Lucida2-FJX", link: "https://h/redmine2/sot/projects/lucida2" },
      { name: "Linus2-FAL", link: "https://h/redmine2/sot/projects/linus2" },
      { name: "Other", link: "https://h/redmine2/sot/projects/other" },
    ],
  },
  { label: "FY25", link: "https://h/redmine2/sot/projects/fy25", projects: [{ name: "Old", link: "https://h/redmine2/sot/projects/old" }] },
];

test("narrowFysByIssues: hanya project yang punya issue, FY kosong dibuang", () => {
  const r = narrowFysByIssues(fys, [
    { href: "https://h/redmine2/sot/projects/lucida2", name: "Lucida2-FJX" },
    { href: "https://h/redmine2/sot/projects/LINUS2/", name: "Linus2-FAL" }, // huruf besar & slash akhir tetap cocok
  ]);
  assert.deepEqual(r.fys.map((f) => [f.label, f.projects.map((p) => p.name)]), [["FY26", ["Lucida2-FJX", "Linus2-FAL"]]]);
  assert.equal(r.kept, 2);
  assert.equal(r.total, 4);
  assert.deepEqual(r.unmatched, []);
  assert.equal(fys[0].projects.length, 3); // input tidak diubah
});

test("narrowFysByIssues: project tak dikenal dilaporkan, issue di FY itu sendiri diabaikan", () => {
  const r = narrowFysByIssues(fys, [
    { href: "https://h/redmine2/sot/projects/deep-sub", name: "Deep Sub" },
    { href: "https://h/redmine2/sot/projects/fy26", name: "FY26" }, // issue langsung di FY, bukan project
    { href: "https://h/redmine2/sot/projects/old", name: "Old" },
  ]);
  assert.deepEqual(r.unmatched, ["Deep Sub"]);
  assert.deepEqual(r.fys.map((f) => f.label), ["FY25"]);
  assert.equal(r.kept, 1);
});

test("narrowFysByIssues: tanpa issue sama sekali -> kept 0 (pemanggil harus menolak, bukan mengosongkan data)", () => {
  const r = narrowFysByIssues(fys, []);
  assert.equal(r.kept, 0);
  assert.deepEqual(r.fys, []);
});

test("selectFys: melewati FY lama dan mempertahankan label non-FY", () => {
  const list = ["FY16", "FY23", "FY24", "FY26", "Archive"].map((label) => ({ label, link: `https://h/p/${label}` }));
  const result = selectFys(list, 24);
  assert.deepEqual(result.selected.map((fy) => fy.label), ["FY24", "FY26", "Archive"]);
  assert.deepEqual(result.skipped.map((fy) => fy.label), ["FY16", "FY23"]);
  assert.equal(selectFys(list).selected.length, 5);
  assert.equal(selectFys(list, "").selected.length, 5);
  assert.equal(selectFys(list, null).skipped.length, 0);
});
