// Pembaca SOT berbasis browser. Dijalankan sebagai proses anak oleh aplikasi (lib/sot-projects-repo.ts),
// bukan langsung oleh pengguna. Tidak menyentuh database: hasilnya dikirim ke aplikasi sebagai baris JSON di stdout.
//
// stdin  : {"kind":"projects"|"members","projectsUrl":"...","targets":[{"key":"...","link":"..."}]}
// stdout : {"type":"log","level":"info|warn","message":"..."}
//          {"type":"result", ...}            (satu kali, di akhir)
//          {"type":"error","message":"..."}  (satu kali, kalau gagal)
// Env    : SOT_HEADLESS=true (tanpa jendela), SOT_BROWSER_PATH (pakai browser lain, bukan Edge),
//          SOT_PROFILE_DIR (default data/edge_sot_profile)
import path from "node:path";
import process from "node:process";
import { closeSession, ensureProjectsPage, openSession, readProjectList, readTargetModels } from "./sot/browser.mjs";

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
    const fys = await readProjectList(session);
    if (fys.length === 0) throw new Error("Tidak ada FY di bawah header 'Projects'. Struktur halaman SOT mungkin berubah.");
    const total = fys.reduce((n, fy) => n + fy.projects.length, 0);
    log("info", `${fys.length} FY dan ${total} project terbaca`);
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
