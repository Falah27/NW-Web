import { DatabaseSync } from "node:sqlite";
import { cleanPrefixes } from "../lib/sot-prefix.ts";

const db = new DatabaseSync("data/dev.db", {
  readOnly: true,
});

try {
  const tableExists = (name) =>
    db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(name) !== undefined;

  console.log("\n=== RIWAYAT SINKRONISASI TERAKHIR ===");

  const lastRuns = db.prepare(`
    SELECT
      id,
      started_at,
      finished_at,
      status,
      project_count,
      member_count,
      error_message
    FROM sot_sync_runs
    ORDER BY id DESC
    LIMIT 5
  `).all();

  console.table(lastRuns);

  console.log("\n=== RINGKASAN DATA SOT ===");

  const summary = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sot_projects)
        AS total_projects,

      (
        SELECT COUNT(*)
        FROM sot_projects
        WHERE is_active = 1
      ) AS active_projects,

      (
        SELECT COUNT(*)
        FROM sot_projects
        WHERE is_active = 0
      ) AS inactive_projects,

      (
        SELECT COUNT(*)
        FROM sot_project_members
      ) AS project_member_relations,

      (
        SELECT COUNT(*)
        FROM sot_project_members
        WHERE mapping_status = 'matched'
      ) AS matched_relations,

      (
        SELECT COUNT(*)
        FROM sot_project_members
        WHERE mapping_status = 'needs_mapping'
      ) AS needs_mapping_relations,

      (
        SELECT COUNT(DISTINCT source_name)
        FROM sot_project_members
        WHERE mapping_status = 'needs_mapping'
      ) AS unique_unmatched_models
  `).get();

  console.table([summary]);

  console.log(
    "\n=== 30 MODEL YANG PALING SERING PERLU MAPPING ==="
  );

  const unmatched = db.prepare(`
    SELECT
      source_name,
      COUNT(DISTINCT project_id) AS used_by_projects
    FROM sot_project_members
    WHERE mapping_status = 'needs_mapping'
    GROUP BY source_name
    ORDER BY used_by_projects DESC, source_name
    LIMIT 30
  `).all();

  console.table(unmatched);

  console.log("\n=== DATA TARGET MODEL MENCURIGAKAN ===");

  const suspicious = db.prepare(`
    SELECT
      source_name,
      LENGTH(source_name) AS text_length,
      COUNT(*) AS occurrences
    FROM sot_project_members
    GROUP BY source_name
    HAVING
      TRIM(source_name) = ''
      OR LENGTH(source_name) > 80
    ORDER BY text_length DESC
  `).all();

  if (suspicious.length === 0) {
    console.log(
      "Tidak ada data kosong atau lebih dari 80 karakter."
    );
  } else {
    console.table(suspicious);
  }

  if (tableExists("model_prefixes")) {
    console.log("\n=== STRUKTUR MODEL_PREFIXES ===");
    console.table(db.prepare("PRAGMA table_info(model_prefixes)").all());

    console.log("\n=== PREFIX YANG BELUM ADA DI MODEL_GROUPS ===");
    const prefixRows = db.prepare(`
    SELECT
      prefix,
      COUNT(DISTINCT source_name) AS source_variants,
      COUNT(DISTINCT project_id) AS used_by_projects
    FROM model_prefixes
    LEFT JOIN sot_project_members
      ON lower(sot_project_members.source_name) LIKE lower(model_prefixes.prefix) || '%'
     AND sot_project_members.mapping_status = 'needs_mapping'
    GROUP BY model_prefixes.prefix
    HAVING NOT EXISTS (
      SELECT 1
      FROM model_groups
      WHERE lower(model_groups.name) = lower(model_prefixes.prefix)
    )
    ORDER BY used_by_projects DESC, source_variants DESC, prefix
    LIMIT 50
    `).all();
    console.table(prefixRows);
  } else {
    console.log("\nTabel model_prefixes belum ada. Jalankan sinkronisasi SOT terlebih dahulu.");
  }

  console.log("\n=== KANDIDAT PREFIX BERDASARKAN cleanPrefixes() ===");
  const unmatchedRows = db.prepare(`
    SELECT source_name, project_id
    FROM sot_project_members
    WHERE mapping_status = 'needs_mapping'
  `).all();
  const candidates = new Map();
  for (const row of unmatchedRows) {
    const prefix = cleanPrefixes(row.source_name)[0];
    if (!prefix) continue;
    const key = prefix.toLowerCase();
    const entry = candidates.get(key) ?? { prefix, source_variants: new Set(), projects: new Set() };
    entry.source_variants.add(row.source_name);
    entry.projects.add(row.project_id);
    candidates.set(key, entry);
  }
  const missingCandidates = [...candidates.values()]
    .filter((entry) => !db.prepare("SELECT 1 FROM model_groups WHERE lower(name) = lower(?)").get(entry.prefix))
    .map((entry) => ({
      prefix: entry.prefix,
      source_variants: entry.source_variants.size,
      used_by_projects: entry.projects.size,
    }))
    .sort((a, b) => b.used_by_projects - a.used_by_projects || b.source_variants - a.source_variants || a.prefix.localeCompare(b.prefix))
    .slice(0, 50);
  console.table(missingCandidates);

  console.log("\n=== MAPPING MANUAL TERSIMPAN ===");
  if (tableExists("sot_model_mappings")) {
    console.table(db.prepare(`
    SELECT
      sm.source_name,
      sm.model_group_id,
      mg.name AS model_group_name,
      sm.created_at,
      sm.updated_at
    FROM sot_model_mappings sm
    JOIN model_groups mg ON mg.id = sm.model_group_id
    ORDER BY sm.source_name
    `).all());
  } else {
    console.log("Belum ada tabel sot_model_mappings. Tabel akan dibuat saat sinkronisasi berikutnya.");
  }
} finally {
  db.close();
}