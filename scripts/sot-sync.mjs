// Pembaca SOT berbasis browser. Dijalankan sebagai proses anak oleh aplikasi (lib/sot-projects-repo.ts),
// bukan langsung oleh pengguna. Tidak menyentuh database: hasilnya dikirim ke aplikasi sebagai baris JSON di stdout.
//
// stdin  : {"kind":"projects"|"leader"|"members","projectsUrl":"...","targets":[{"key":"...","link":"..."}],
//           "selectedFys":["FY18"],"teamLeaderId":"659","teamLeaderField":"cf_3"}   (field tambahan untuk leader)
// stdout : {"type":"log","level":"info|warn","message":"..."}
//          {"type":"result", ...}            (satu kali, di akhir)
//          {"type":"error","message":"..."}  (satu kali, kalau gagal)
// Env    : SOT_HEADLESS=true (tanpa jendela), SOT_BROWSER_PATH (pakai browser lain, bukan Edge),
//          SOT_PROFILE_DIR (default data/edge_sot_profile)
import path from "node:path";
import process from "node:process";
import {
  closeSession,
  ensureProjectsPage,
  openSession,
  readIssueProjects,
  readProjectList,
  readTargetModels,
} from "./sot/browser.mjs";
import { narrowFysByIssues, projectKey } from "./sot/team-filter.mjs";
import { readIntEnv } from "./sot/retry.mjs";

const TARGET_MODEL_LABEL = "対象機種";
const issueTimeoutMs = readIntEnv(process.env.SOT_FETCH_TIMEOUT_MS, { def: 120_000, min: 10_000, max: 600_000 });
const issueRetries = readIntEnv(process.env.SOT_FETCH_RETRIES, { def: 2, min: 0, max: 5 });

const emit = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const log = (level, message) => emit({ type: "log", level, message });

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

let session;
async function shutdown(code) {
  await closeSession(session);
  process.exit(code);
}
process.on("SIGTERM", () => void shutdown(1));
process.on("SIGINT", () => void shutdown(1));

try {
  const input = await readStdin();
  if (!input.projectsUrl) throw new Error("projectsUrl kosong. Isi SOT_PROJECTS_URL di .env.local.");

  session = await openSession({
    profileDir: process.env.SOT_PROFILE_DIR || path.join(process.cwd(), "data", "edge_sot_profile"),
    headless: process.env.SOT_HEADLESS === "true",
    executablePath: process.env.SOT_BROWSER_PATH || undefined,
    projectsUrl: input.projectsUrl,
    log,
  });
  log("info", "Edge dibuka");
  await ensureProjectsPage(session);

  if (input.kind === "projects") {
    const fys = await readProjectList(session);
    if (fys.length === 0) throw new Error("Tidak ada FY di bawah header 'Projects'. Struktur halaman SOT mungkin berubah.");
    const total = fys.reduce((n, fy) => n + fy.projects.length, 0);
    log("info", `${fys.length} FY dan ${total} project terbaca`);

    emit({ type: "result", kind: "projects", fys });
  } else if (input.kind === "leader") {
    const selected = Array.isArray(input.selectedFys) ? input.selectedFys : [];
    if (selected.length === 0) throw new Error("Pilih minimal satu FY.");
    const allFys = await readProjectList(session);
    const missing = selected.filter((label) => !allFys.some((fy) => fy.label === label));
    if (missing.length > 0) throw new Error(`FY tidak ditemukan di SOT: ${missing.join(", ")}. Data project tidak diubah.`);
    const selectedSet = new Set(selected);
    const chosen = allFys.filter((fy) => selectedSet.has(fy.label));
    const leader = { leaderField: input.teamLeaderField || "cf_3", leaderId: String(input.teamLeaderId || "") };
    const found = await readIssueProjects(session, chosen, { ...leader, timeoutMs: issueTimeoutMs, retries: issueRetries }, (done, all, result) => {
      const duration = result?.elapsedMs === undefined ? "" : `, ${(result.elapsedMs / 1000).toFixed(1)} dtk`;
      log("info", `Issue FY ${done} dari ${all} (${result?.fy ?? "-"}${duration})`);
    });
    const failed = found.filter((f) => f.status !== "ok");
    if (failed.length > 0) {
      throw new Error(`Gagal membaca issue ${failed.map((f) => `${f.fy} (${f.message ?? f.status})`).join(", ")}. Data project tidak diubah.`);
    }
    const narrowed = narrowFysByIssues(chosen, found.flatMap((f) => f.projects));
    if (narrowed.kept === 0) throw new Error(`Tidak ada issue untuk Team Leader ${leader.leaderId} (${leader.leaderField}). Data project tidak diubah.`);
    emit({
      type: "result",
      kind: "leader",
      scope: selected,
      keptKeys: narrowed.fys.flatMap((fy) => fy.projects.map((project) => projectKey(project.link))),
    });
  } else if (input.kind === "members") {
    const targets = Array.isArray(input.targets) ? input.targets : [];
    log("info", `Membaca target model ${targets.length} project`);
    const items = await readTargetModels(session, targets, TARGET_MODEL_LABEL, (done, total) =>
      log("info", `Project ${done} dari ${total}`)
    );
    emit({ type: "result", kind: "members", items });
  } else {
    throw new Error(`Jenis proses tidak dikenal: ${input.kind}`);
  }
  await shutdown(0);
} catch (error) {
  emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
  await shutdown(1);
}
