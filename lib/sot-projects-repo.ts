import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { getDb } from "./db";
import { buildModelPrefixes, getPrefixSummary, type PrefixBuildResult } from "./sot-prefix-repo";
import { matchModelGroup, type ManualMappings, type NamedGroup } from "./sot-prefix";

// Pembacaan SOT dilakukan oleh scripts/sot-sync.mjs (browser Edge) sebagai proses anak.
// File ini: menjalankan proses itu, menyimpan hasilnya ke database, dan melaporkan statusnya ke UI.

export type SotRunKind = "projects" | "leader" | "members";

export interface SotRunInfo {
  id: number;
  kind: SotRunKind;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt: string | null;
  detail: string | null;
  projectCount: number;
  memberCount: number;
  error: string | null;
}

export interface SotState {
  running: boolean;
  run: SotRunInfo | null;
  progress: { done: number; total: number; empty: number; failed: number };
  logs: { ts: string; level: string; message: string }[];
  fys: { fy: string; projects: number; withMembers: number }[];
  totals: { projects: number; memberNames: number; unmatched: number };
  prefix: { total: number; builtAt: string | null };
  leaderConfigured: boolean;
}

const PROJECTS_URL = process.env.SOT_PROJECTS_URL?.trim() ?? "";
const SCRIPT_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "scripts", "sot-sync.mjs");

// Satu proses sekaligus. Disimpan di globalThis supaya tidak hilang saat modul dimuat ulang (mode dev).
const g = globalThis as unknown as { __sotRun?: { runId: number; child: ChildProcess; cancelled: boolean } };

function addLog(runId: number, level: string, message: string) {
  getDb()
    .prepare("INSERT INTO sot_sync_logs (run_id, ts, level, message) VALUES (?, ?, ?, ?)")
    .run(runId, new Date().toISOString(), level, message.slice(0, 2000));
}

// Run yang berstatus 'running' padahal tidak ada proses yang dipantau = aplikasi sempat berhenti.
function reconcileStaleRun() {
  if (g.__sotRun) return;
  getDb()
    .prepare(
      "UPDATE sot_sync_runs SET status = 'failed', finished_at = ?, error_message = ? WHERE status = 'running'"
    )
    .run(new Date().toISOString(), "Proses terhenti sebelum selesai (aplikasi dimatikan atau di-restart).");
}

function finishRun(runId: number, status: "success" | "failed", projectCount: number, memberCount: number, error?: string) {
  getDb()
    .prepare(
      "UPDATE sot_sync_runs SET finished_at = ?, status = ?, project_count = ?, member_count = ?, error_message = ? WHERE id = ?"
    )
    .run(new Date().toISOString(), status, projectCount, memberCount, error ?? null, runId);
}

// ---------------------------------------------------------------------------
// Menyimpan hasil dari browser
// ---------------------------------------------------------------------------

interface FyResult {
  label: string;
  projects: { name: string; link: string }[];
}
interface MemberItem {
  key: string;
  status: "ok" | "none" | "login" | "http" | "error";
  value?: string;
  message?: string;
}

// Daftar project: baru ditambah, yang sudah ada diperbarui (nama/FY/link). Project yang tidak lagi
// muncul di SOT ditandai tidak aktif. Target model tidak disentuh.
function applyProjectList(runId: number, fys: FyResult[]): number {
  const db = getDb();
  const startedAt = new Date().toISOString();
  let total = 0;
  let added = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    const exists = db.prepare("SELECT 1 FROM sot_projects WHERE external_key = ?");
    const upsert = db.prepare(`
      INSERT INTO sot_projects (external_key, fy, project_name, project_link, is_active, updated_at, last_seen_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(external_key) DO UPDATE SET
        fy = excluded.fy,
        project_name = excluded.project_name,
        project_link = excluded.project_link,
        is_active = 1,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at
    `);
    for (const fy of fys) {
      for (const project of fy.projects) {
        const key = new URL(project.link).pathname.replace(/\/+$/, "");
        if (!exists.get(key)) added += 1;
        upsert.run(key, fy.label, project.name, project.link, startedAt, startedAt);
        total += 1;
      }
    }
    const gone = db.prepare("UPDATE sot_projects SET is_active = 0 WHERE is_active = 1 AND last_seen_at < ?").run(startedAt);
    db.exec("COMMIT");
    addLog(runId, "info", `${fys.length} FY, ${total} project (${added} baru, ${Number(gone.changes)} tidak aktif lagi)`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return total;
}

export function applyLeaderFilter(runId: number, scope: string[], keptKeys: string[]): { kept: number; deactivated: number } {
  if (scope.length === 0) throw new Error("Scope FY kosong.");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const deactivate = db.prepare("UPDATE sot_projects SET is_active = 0 WHERE fy = ?");
    for (const fy of scope) deactivate.run(fy);
    const activate = db.prepare("UPDATE sot_projects SET is_active = 1 WHERE external_key = ? AND fy = ?");
    for (const key of keptKeys) {
      for (const fy of scope) activate.run(key, fy);
    }
    const placeholders = scope.map(() => "?").join(",");
    const kept = Number(
      (db.prepare(`SELECT COUNT(*) AS n FROM sot_projects WHERE is_active = 1 AND fy IN (${placeholders})`).get(...scope) as { n: number }).n
    );
    const deactivated = Number(
      (db.prepare(`SELECT COUNT(*) AS n FROM sot_projects WHERE is_active = 0 AND fy IN (${placeholders})`).get(...scope) as { n: number }).n
    );
    db.exec("COMMIT");
    addLog(runId, "info", `Filter Team Leader: ${kept} dari ${kept + deactivated} project dipertahankan di ${scope.join(", ")} (${deactivated} dinonaktifkan)`);
    return { kept, deactivated };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function splitMembers(value: string): string[] {
  const names = value
    .split(/[、,，;；|/]/)
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Map(names.map((name) => [name.toLowerCase(), name])).values()];
}

function loadGroups(): NamedGroup[] {
  return getDb().prepare("SELECT id, name FROM model_groups").all() as unknown as NamedGroup[];
}

// Mapping manual dari halaman SOT Job. Harus dibaca setiap kali mencocokkan model,
// kalau tidak pilihan pengguna tertimpa saat sinkron "Target model" berikutnya.
function loadManualMappings(): ManualMappings {
  const rows = getDb()
    .prepare("SELECT source_name, model_group_id FROM sot_model_mappings")
    .all() as unknown as { source_name: string; model_group_id: number }[];
  return new Map(rows.map((row) => [row.source_name.trim().toLowerCase(), row.model_group_id]));
}

// Target model: hanya project yang berhasil dibaca yang ditimpa. "Tidak ada field" atau gagal
// membiarkan data lama apa adanya (sama seperti macro VBA).
function applyMembers(runId: number, items: MemberItem[]): { updated: number; members: number } {
  const db = getDb();
  const groups = loadGroups();
  const manual = loadManualMappings();
  const groupName = new Map(groups.map((g2) => [g2.id, g2.name]));
  const notes: { level: string; message: string }[] = [];
  let updated = 0;
  let members = 0;
  let none = 0;
  let failed = 0;
  let fuzzy = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    const select = db.prepare("SELECT id, project_name FROM sot_projects WHERE external_key = ?");
    const clear = db.prepare("DELETE FROM sot_project_members WHERE project_id = ?");
    const insert = db.prepare(`
      INSERT INTO sot_project_members (project_id, source_name, model_group_id, mapping_status, mapping_method)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      const project = select.get(item.key) as { id: number; project_name: string } | undefined;
      if (!project) continue;
      if (item.status === "none") {
        none += 1;
        notes.push({ level: "info", message: `${project.project_name}: tidak ada field target model, data lama dipertahankan` });
        continue;
      }
      if (item.status !== "ok" || !item.value) {
        failed += 1;
        notes.push({ level: "warn", message: `${project.project_name}: gagal dibaca (${item.message ?? item.status})` });
        continue;
      }
      clear.run(project.id);
      for (const name of splitMembers(item.value)) {
        const match = matchModelGroup(name, groups, manual);
        insert.run(project.id, name, match?.id ?? null, match ? "matched" : "needs_mapping", match?.method ?? null);
        members += 1;
        if (match && match.method !== "exact" && match.method !== "manual") {
          fuzzy += 1;
          if (fuzzy <= 15) {
            notes.push({ level: "info", message: `Dicocokkan lewat ${match.method}: "${name}" -> "${groupName.get(match.id)}"` });
          }
        }
      }
      updated += 1;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  for (const note of notes) addLog(runId, note.level, note.message);
  addLog(runId, "info", `${updated} project diperbarui, ${none} tanpa field, ${failed} gagal, ${members} target model`);
  return { updated, members };
}

/** Mencoba lagi mencocokkan model yang masih needs_mapping (mis. setelah grup model baru diimpor). */
export function remapNeedsMapping(): { matched: number; remaining: number } {
  const db = getDb();
  const groups = loadGroups();
  const manual = loadManualMappings();
  const rows = db
    .prepare("SELECT project_id, source_name FROM sot_project_members WHERE mapping_status = 'needs_mapping'")
    .all() as unknown as { project_id: number; source_name: string }[];
  let matched = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    const update = db.prepare(`
      UPDATE sot_project_members
      SET model_group_id = ?, mapping_status = 'matched', mapping_method = ?
      WHERE project_id = ? AND source_name = ?
    `);
    for (const row of rows) {
      const match = matchModelGroup(row.source_name, groups, manual);
      if (!match) continue;
      update.run(match.id, match.method, row.project_id, row.source_name);
      matched += 1;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { matched, remaining: rows.length - matched };
}

// ---------------------------------------------------------------------------
// Menjalankan scraper
// ---------------------------------------------------------------------------

function watchChild(runId: number, kind: SotRunKind, child: ChildProcess) {
  let result: { fys?: FyResult[]; items?: MemberItem[]; scope?: string[]; keptKeys?: string[] } | null = null;
  let scriptError: string | null = null;
  let stderrTail = "";
  let spawnError: string | null = null;

  const safe = (fn: () => void) => {
    try {
      fn();
    } catch {
      // pencatatan tidak boleh menjatuhkan server
    }
  };

  readline.createInterface({ input: child.stdout! }).on("line", (line) =>
    safe(() => {
      let msg: { type?: string; level?: string; message?: string; fys?: FyResult[]; items?: MemberItem[]; scope?: string[]; keptKeys?: string[] };
      try {
        msg = JSON.parse(line);
      } catch {
        addLog(runId, "info", line);
        return;
      }
      if (msg.type === "log") addLog(runId, msg.level ?? "info", msg.message ?? "");
      else if (msg.type === "result") result = msg;
      else if (msg.type === "error") scriptError = msg.message ?? "Proses SOT gagal.";
    })
  );
  child.stderr!.on("data", (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString("utf8")).slice(-1500);
  });
  child.on("error", (error) => {
    spawnError = `Proses SOT tidak bisa dijalankan: ${error.message}`;
  });

  child.on("close", (code) => {
    const handle = g.__sotRun;
    const cancelled = handle?.runId === runId && handle.cancelled;
    g.__sotRun = undefined;
    safe(() => {
      if (cancelled) {
        addLog(runId, "warn", "Dibatalkan oleh pengguna");
        finishRun(runId, "failed", 0, 0, "Dibatalkan oleh pengguna.");
        return;
      }
      const failure = scriptError ?? spawnError ?? (code !== 0 || !result ? stderrTail.trim() || `Proses berhenti (kode ${code}).` : null);
      if (failure) {
        addLog(runId, "error", failure);
        finishRun(runId, "failed", 0, 0, failure);
        return;
      }
      try {
        if (kind === "projects") {
          const projects = applyProjectList(runId, result!.fys ?? []);
          finishRun(runId, "success", projects, 0);
        } else if (kind === "leader") {
          const filtered = applyLeaderFilter(runId, result!.scope ?? [], result!.keptKeys ?? []);
          finishRun(runId, "success", filtered.kept, 0);
        } else {
          const done = applyMembers(runId, result!.items ?? []);
          const remap = remapNeedsMapping();
          if (remap.matched > 0) addLog(runId, "info", `${remap.matched} model lama berhasil dicocokkan ulang`);
          finishRun(runId, "success", done.updated, done.members);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal menyimpan hasil SOT.";
        addLog(runId, "error", message);
        finishRun(runId, "failed", 0, 0, message);
      }
    });
  });
}

/** Memulai pembacaan SOT di latar belakang. Mengembalikan id run; kemajuannya dibaca lewat getSotState(). */
export function startSotRun(kind: SotRunKind, fys: string[] = []): number {
  reconcileStaleRun();
  if (g.__sotRun) throw new Error("Masih ada proses SOT yang berjalan. Tunggu sampai selesai atau batalkan.");
  if (!PROJECTS_URL) throw new Error("SOT_PROJECTS_URL wajib diisi di .env.local. Lihat .env.example.");
  const db = getDb();

  let targets: { key: string; link: string }[] = [];
  let detail: string | null = null;
  if (kind === "members") {
    const wanted = [...new Set(fys.map((fy) => fy.trim()).filter(Boolean))];
    if (wanted.length === 0) throw new Error("Pilih minimal satu FY.");
    targets = db
      .prepare(
        `SELECT external_key AS key, project_link AS link FROM sot_projects
         WHERE is_active = 1 AND fy IN (${wanted.map(() => "?").join(",")}) ORDER BY id`
      )
      .all(...wanted) as unknown as { key: string; link: string }[];
    if (targets.length === 0) throw new Error("Tidak ada project aktif pada FY yang dipilih. Baca daftar project dulu.");
    detail = wanted.join(", ");
  }
  let teamLeaderId = "";
  let teamLeaderField = "cf_3";
  let selectedFys: string[] = [];
  if (kind === "leader") {
    selectedFys = [...new Set(fys.map((fy) => fy.trim()).filter(Boolean))];
    if (selectedFys.length === 0) throw new Error("Pilih minimal satu FY.");
    teamLeaderId = process.env.SOT_TEAM_LEADER_ID?.trim() ?? "";
    if (!teamLeaderId) throw new Error("SOT_TEAM_LEADER_ID belum diisi di .env.local.");
    if (!/^\d+$/.test(teamLeaderId)) {
      throw new Error("SOT_TEAM_LEADER_ID harus berupa angka (ID user di SOT), contoh 659.");
    }
    teamLeaderField = process.env.SOT_TEAM_LEADER_FIELD?.trim() || "cf_3";
    if (!/^cf_\d+$/.test(teamLeaderField)) {
      throw new Error('SOT_TEAM_LEADER_FIELD harus berformat "cf_<angka>", contoh cf_3.');
    }
    detail = `Team Leader ${teamLeaderId}: ${selectedFys.join(", ")}`;
  }

  const run = db
    .prepare("INSERT INTO sot_sync_runs (started_at, status, kind, detail) VALUES (?, 'running', ?, ?)")
    .run(new Date().toISOString(), kind, detail);
  const runId = Number(run.lastInsertRowid);

  const child = spawn(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  g.__sotRun = { runId, child, cancelled: false };
  watchChild(runId, kind, child);
  child.stdin!.on("error", () => {});
  child.stdin!.end(JSON.stringify({ kind, projectsUrl: PROJECTS_URL, targets, selectedFys, teamLeaderId, teamLeaderField }));
  return runId;
}

export function cancelSotRun(): boolean {
  const handle = g.__sotRun;
  if (!handle || !handle.child.pid) return false;
  handle.cancelled = true;
  if (process.platform === "win32") {
    // Edge ikut dimatikan (seluruh pohon proses), supaya profil tidak terkunci di run berikutnya.
    spawn("taskkill", ["/PID", String(handle.child.pid), "/T", "/F"], { windowsHide: true });
  } else {
    handle.child.kill("SIGTERM");
  }
  return true;
}

/** Prefix + pencocokan ulang model. Tidak butuh browser, jadi langsung selesai. */
export function runPrefixAndMapping(): PrefixBuildResult & { matched: number; remaining: number } {
  const prefix = buildModelPrefixes();
  return { ...prefix, ...remapNeedsMapping() };
}

export function getSotState(): SotState {
  reconcileStaleRun();
  const db = getDb();

  const last = db
    .prepare(
      `SELECT id, kind, status, started_at, finished_at, detail, project_count, member_count, error_message
       FROM sot_sync_runs ORDER BY id DESC LIMIT 1`
    )
    .get() as
    | {
        id: number; kind: SotRunKind; status: SotRunInfo["status"]; started_at: string; finished_at: string | null;
        detail: string | null; project_count: number; member_count: number; error_message: string | null;
      }
    | undefined;

  const logs = last
    ? (
        db
          .prepare("SELECT ts, level, message FROM sot_sync_logs WHERE run_id = ? ORDER BY id DESC LIMIT 40")
          .all(last.id) as unknown as { ts: string; level: string; message: string }[]
      )
        .map((row) => ({ ts: row.ts, level: row.level, message: row.message }))
        .reverse()
    : [];
  const progress = { done: 0, total: 0, empty: 0, failed: 0 };
  for (const log of logs) {
    const reading = log.message.match(/Project (\d+) dari (\d+)/i);
    if (reading) {
      progress.done = Number(reading[1]);
      progress.total = Number(reading[2]);
    }
    const result = log.message.match(/(\d+) project diperbarui, (\d+) tanpa field, (\d+) gagal/i);
    if (result) {
      progress.done = Number(result[1]) + Number(result[2]) + Number(result[3]);
      progress.total = progress.done;
      progress.empty = Number(result[2]);
      progress.failed = Number(result[3]);
    }
  }

  const fys = (
    db
      .prepare(
        `SELECT p.fy AS fy, COUNT(*) AS projects,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM sot_project_members m WHERE m.project_id = p.id) THEN 1 ELSE 0 END) AS withMembers
         FROM sot_projects p WHERE p.is_active = 1 GROUP BY p.fy ORDER BY p.fy DESC`
      )
      .all() as unknown as { fy: string; projects: number; withMembers: number }[]
  ).map((row) => ({ fy: row.fy, projects: Number(row.projects), withMembers: Number(row.withMembers) }));

  const count = (sql: string) => Number((db.prepare(sql).get() as { n: number }).n);
  const leaderId = process.env.SOT_TEAM_LEADER_ID?.trim() ?? "";
  const leaderField = process.env.SOT_TEAM_LEADER_FIELD?.trim() || "cf_3";
  return {
    running: Boolean(g.__sotRun),
    run: last
      ? {
          id: last.id, kind: last.kind, status: last.status, startedAt: last.started_at, finishedAt: last.finished_at,
          detail: last.detail, projectCount: last.project_count, memberCount: last.member_count, error: last.error_message,
        }
      : null,
    progress,
    logs,
    fys,
    totals: {
      projects: count("SELECT COUNT(*) AS n FROM sot_projects WHERE is_active = 1"),
      memberNames: count(
        `SELECT COUNT(DISTINCT lower(m.source_name)) AS n FROM sot_project_members m
         JOIN sot_projects p ON p.id = m.project_id WHERE p.is_active = 1`
      ),
      unmatched: count(
        `SELECT COUNT(DISTINCT lower(m.source_name)) AS n FROM sot_project_members m
         JOIN sot_projects p ON p.id = m.project_id WHERE p.is_active = 1 AND m.mapping_status = 'needs_mapping'`
      ),
    },
    prefix: getPrefixSummary(),
    leaderConfigured: /^\d+$/.test(leaderId) && /^cf_\d+$/.test(leaderField),
  };
}

export function getLastSotSync() {
  return getDb()
    .prepare("SELECT started_at, finished_at, status, project_count, member_count, error_message FROM sot_sync_runs ORDER BY id DESC LIMIT 1")
    .get() as
    | { started_at: string; finished_at: string | null; status: string; project_count: number; member_count: number; error_message: string | null }
    | undefined;
}
