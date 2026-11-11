import { getDb } from "./db";

export interface SotJobTarget {
  sourceName: string;
  groupName: string | null;
  status: "matched" | "needs_mapping";
  method: string | null;
}

export interface SotJobProject {
  id: number;
  fy: string;
  projectName: string;
  projectLink: string;
  updatedAt: string;
  targets: SotJobTarget[];
}

export interface SotJobData {
  projects: SotJobProject[];
  lastSyncAt: string | null;
  totals: {
    projects: number;
    fys: number;
    targets: number;
    matched: number;
    unmatched: number;
  };
}

export interface SotJobModelGroup {
  id: number;
  name: string;
}

function ensureMappingMethodColumn() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(sot_project_members)").all() as unknown as { name: string }[];
  if (columns.length > 0 && !columns.some((column) => column.name === "mapping_method")) {
    db.exec("ALTER TABLE sot_project_members ADD COLUMN mapping_method TEXT");
  }
}

export function getSotJobData(): SotJobData {
  const db = getDb();
  ensureMappingMethodColumn();
  const projectRows = db
    .prepare(
      `SELECT id, fy, project_name, project_link, updated_at
       FROM sot_projects
       WHERE is_active = 1
       ORDER BY fy DESC, project_name COLLATE NOCASE`
    )
    .all() as unknown as {
    id: number;
    fy: string;
    project_name: string;
    project_link: string;
    updated_at: string;
  }[];
  const memberRows = db
    .prepare(
      `SELECT m.project_id, m.source_name, m.mapping_status, m.mapping_method, mg.name AS group_name
       FROM sot_project_members m
       LEFT JOIN model_groups mg ON mg.id = m.model_group_id
       WHERE m.project_id IN (SELECT id FROM sot_projects WHERE is_active = 1)
       ORDER BY m.project_id, m.source_name COLLATE NOCASE`
    )
    .all() as unknown as {
    project_id: number;
    source_name: string;
    mapping_status: "matched" | "needs_mapping";
    mapping_method: string | null;
    group_name: string | null;
  }[];
  const targetsByProject = new Map<number, SotJobTarget[]>();

  for (const row of memberRows) {
    const targets = targetsByProject.get(row.project_id) ?? [];
    targets.push({
      sourceName: row.source_name,
      groupName: row.group_name,
      status: row.mapping_status,
      method: row.mapping_method,
    });
    targetsByProject.set(row.project_id, targets);
  }

  const projects = projectRows.map((row) => ({
    id: row.id,
    fy: row.fy,
    projectName: row.project_name,
    projectLink: row.project_link,
    updatedAt: row.updated_at,
    targets: targetsByProject.get(row.id) ?? [],
  }));
  // Project tidak aktif tidak diambil di atas. Barisnya tetap ada di database dan aktif lagi saat muncul di sinkron berikutnya.
  const targets = projects.flatMap((project) => project.targets);
  const lastSync = db
    .prepare(
      `SELECT finished_at FROM sot_sync_runs
       WHERE status = 'success' AND finished_at IS NOT NULL
       ORDER BY id DESC LIMIT 1`
    )
    .get() as { finished_at: string } | undefined;

  return {
    projects,
    lastSyncAt: lastSync?.finished_at ?? null,
    totals: {
      projects: projects.length,
      fys: new Set(projects.map((project) => project.fy)).size,
      targets: targets.length,
      matched: targets.filter((target) => target.status === "matched").length,
      unmatched: targets.filter((target) => target.status === "needs_mapping").length,
    },
  };
}

export function getSotJobModelGroups(): SotJobModelGroup[] {
  return getDb()
    .prepare("SELECT id, name FROM model_groups ORDER BY name COLLATE NOCASE")
    .all()
    .map((row) => {
      const value = row as unknown as SotJobModelGroup;
      return { id: Number(value.id), name: String(value.name) };
    });
}

export function saveSotManualMapping(projectId: number, sourceName: string, modelGroupId: number | null): void {
  const db = getDb();
  ensureMappingMethodColumn();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sot_model_mappings (
      source_name TEXT PRIMARY KEY COLLATE NOCASE,
      model_group_id INTEGER NOT NULL REFERENCES model_groups(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const project = db
    .prepare("SELECT 1 FROM sot_projects WHERE id = ?")
    .get(projectId) as { 1: number } | undefined;
  if (!project) throw new Error("Project SOT tidak ditemukan.");

  db.exec("BEGIN IMMEDIATE");
  try {
    if (modelGroupId === null) {
      const result = db.prepare(
        `UPDATE sot_project_members
         SET model_group_id = NULL, mapping_status = 'needs_mapping', mapping_method = NULL
         WHERE project_id = ? AND source_name = ?`
      ).run(projectId, sourceName);
      if (Number(result.changes) === 0) throw new Error("Target model SOT tidak ditemukan.");
      // Hapus juga mapping permanennya, kalau tidak sinkron berikutnya memasangnya lagi.
      db.prepare("DELETE FROM sot_model_mappings WHERE source_name = ?").run(sourceName);
    } else {
      const group = db.prepare("SELECT 1 FROM model_groups WHERE id = ?").get(modelGroupId);
      if (!group) throw new Error("Model group tidak ditemukan.");
      const result = db.prepare(
        `UPDATE sot_project_members
         SET model_group_id = ?, mapping_status = 'matched', mapping_method = 'manual'
         WHERE project_id = ? AND source_name = ?`
      ).run(modelGroupId, projectId, sourceName);
      if (Number(result.changes) === 0) throw new Error("Target model SOT tidak ditemukan.");

      db.prepare(
        `INSERT INTO sot_model_mappings (source_name, model_group_id, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(source_name) DO UPDATE SET model_group_id = excluded.model_group_id, updated_at = excluded.updated_at`
      ).run(sourceName, modelGroupId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function clearSotData(): void {
  const db = getDb();
  const running = db
    .prepare("SELECT 1 FROM sot_sync_runs WHERE status = 'running' LIMIT 1")
    .get();
  if (running) throw new Error("Hentikan sinkronisasi SOT yang sedang berjalan terlebih dahulu.");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      DELETE FROM sot_project_members;
      DELETE FROM sot_sync_logs;
      DELETE FROM sot_sync_runs;
      DELETE FROM sot_projects;
      DELETE FROM model_prefixes;
      DELETE FROM model_prefix_runs;
      DELETE FROM sot_model_mappings;
    `);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
