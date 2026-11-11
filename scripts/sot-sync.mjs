// Pembaca SOT berbasis browser. Dijalankan sebagai proses anak oleh aplikasi (lib/sot-projects-repo.ts),
// bukan langsung oleh pengguna. Tidak menyentuh database: hasilnya dikirim ke aplikasi sebagai baris JSON di stdout.
//
// stdin  : {"kind":"projects"|"members","projectsUrl":"...","targets":[{"key":"...","link":"..."}],
//           "teamLeaderId":"659","teamLeaderField":"cf_3"}   (dua terakhir opsional, hanya untuk kind "projects")
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
import { narrowFysByIssues } from "./sot/team-filter.mjs";

const TARGET_MODEL_LABEL = "対象機種";

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
    let fys = await readProjectList(session);
    if (fys.length === 0) throw new Error("Tidak ada FY di bawah header 'Projects'. Struktur halaman SOT mungkin berubah.");
    const total = fys.reduce((n, fy) => n + fy.projects.length, 0);
    log("info", `${fys.length} FY dan ${total} project terbaca`);

    // Filter Team Leader: hanya project yang punya issue dengan Team Leader itu yang dipertahankan.
    // Gagal-aman: kalau ada FY yang gagal dibaca atau hasilnya kosong, proses dihentikan dan data lama tidak disentuh.
    if (input.teamLeaderId) {
      const leader = { leaderField: input.teamLeaderField || "cf_3", leaderId: String(input.teamLeaderId) };
      log("info", `Filter Team Leader (${leader.leaderField} = ${leader.leaderId}): membaca issue ${fys.length} FY`);
      const found = await readIssueProjects(session, fys, leader, (done, all) => log("info", `Issue FY ${done} dari ${all}`));

      const failed = found.filter((f) => f.status !== "ok");
      if (failed.length > 0) {
        throw new Error(
          `Gagal membaca issue ${failed.map((f) => `${f.fy} (${f.message ?? f.status})`).join(", ")}. Daftar project tidak diubah.`
        );
      }
      for (const f of found) if (f.issues > 0) log("info", `${f.fy}: ${f.issues} issue di ${f.projects.length} project`);

      const narrowed = narrowFysByIssues(fys, found.flatMap((f) => f.projects));
      if (narrowed.kept === 0) {
        throw new Error(
          `Tidak ada issue untuk Team Leader ${leader.leaderId} (${leader.leaderField}). Periksa SOT_TEAM_LEADER_ID dan SOT_TEAM_LEADER_FIELD. Daftar project tidak diubah.`
        );
      }
      if (narrowed.unmatched.length > 0) {
        const names = narrowed.unmatched.slice(0, 10).join(", ");
        log("warn", `${narrowed.unmatched.length} project di issue tidak ada di daftar project dan dilewati: ${names}${narrowed.unmatched.length > 10 ? ", ..." : ""}`);
      }
      log("info", `Filter Team Leader: ${narrowed.kept} dari ${narrowed.total} project dipertahankan`);
      fys = narrowed.fys;
    }
    emit({ type: "result", kind: "projects", fys });
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
