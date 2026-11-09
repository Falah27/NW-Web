import { getDb } from "./db";

export interface SotProject {
  id: number;
  externalKey: string;
  fy: string;
  projectName: string;
  projectLink: string;
  members: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface SotSyncResult {
  projectCount: number;
  memberCount: number;
  unmatchedMembers: string[];
}

interface ParsedProject {
  externalKey: string;
  fy: string;
  projectName: string;
  projectLink: string;
  members: string[];
}

const PROJECTS_URL =
  process.env.SOT_PROJECTS_URL ??
  "https://jpeaws482.apo.epson.net/redmine2/sot/projects";
const TARGET_MODEL_LABEL = "対象機種";

function ensureTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS sot_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_key TEXT NOT NULL UNIQUE,
      fy TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_link TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sot_project_members (
      project_id INTEGER NOT NULL REFERENCES sot_projects(id) ON DELETE CASCADE,
      source_name TEXT NOT NULL,
      model_group_id INTEGER REFERENCES model_groups(id),
      mapping_status TEXT NOT NULL CHECK (mapping_status IN ('matched', 'needs_mapping')),
      PRIMARY KEY (project_id, source_name)
    );
    CREATE TABLE IF NOT EXISTS sot_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
      project_count INTEGER NOT NULL DEFAULT 0,
      member_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
  `);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href: string): string {
  return new URL(decodeHtml(href), PROJECTS_URL).toString();
}

function parseProjects(html: string): ParsedProject[] {
  const projects: ParsedProject[] = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']*\/projects\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html))) {
    const projectLink = absoluteUrl(match[1]);
    const projectName = decodeHtml(match[2].replace(/<[^>]+>/g, " "));
    if (!projectName) continue;

    const externalKey = new URL(projectLink).pathname.replace(/\/+$/, "");
    if (projects.some((project) => project.externalKey === externalKey)) continue;

    const context = html.slice(Math.max(0, match.index - 800), match.index + match[0].length + 800);
    const fyMatch = context.match(/\b(FY\d{2})\b/i);
    projects.push({
      externalKey,
      fy: fyMatch?.[1].toUpperCase() ?? "UNKNOWN",
      projectName,
      projectLink,
      members: [],
    });
  }

  if (projects.length === 0) {
    throw new Error("Tidak menemukan link project SOT. Periksa URL, login, atau struktur halaman SOT.");
  }
  return projects;
}

function parseMembers(html: string): string[] {
  const text = decodeHtml(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const labelIndex = text.indexOf(TARGET_MODEL_LABEL);
  if (labelIndex < 0) return [];

  const value = text.slice(labelIndex + TARGET_MODEL_LABEL.length, labelIndex + TARGET_MODEL_LABEL.length + 240);
  const cleaned = value.replace(/^[\s:：-]+/, "").split(/\s{2,}|(?:\b(?:担当|責任|Status|更新)\b)/i)[0].trim();
  return cleaned
    .split(/[、,，;；|/]/)
    .map((member) => member.trim())
    .filter(Boolean);
}

async function fetchHtml(url: string): Promise<string> {
  const headers: HeadersInit = { Accept: "text/html" };
  const cookie = process.env.SOT_COOKIE?.trim();
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`SOT mengembalikan HTTP ${response.status} untuk ${url}.`);
  const html = await response.text();
  if (/login|companyaccount/i.test(response.url) || /login with companyaccount/i.test(html)) {
    throw new Error("Sesi login SOT tidak tersedia. Isi SOT_COOKIE dari sesi LAN yang sudah login.");
  }
  return html;
}

export async function syncSotProjects(): Promise<SotSyncResult> {
  ensureTables();
  const db = getDb();
  const startedAt = new Date().toISOString();
  const run = db
    .prepare("INSERT INTO sot_sync_runs (started_at, status) VALUES (?, 'running')")
    .run(startedAt);
  const runId = Number(run.lastInsertRowid);

  try {
    const projects = parseProjects(await fetchHtml(PROJECTS_URL));
    for (const project of projects) {
      project.members = parseMembers(await fetchHtml(project.projectLink));
    }

    const unmatched = new Set<string>();
    db.exec("BEGIN IMMEDIATE");
    try {
      const upsertProject = db.prepare(`
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
      const selectProject = db.prepare("SELECT id FROM sot_projects WHERE external_key = ?");
      const selectModel = db.prepare("SELECT id FROM model_groups WHERE lower(name) = lower(?)");
      const clearMembers = db.prepare("DELETE FROM sot_project_members WHERE project_id = ?");
      const insertMember = db.prepare(`
        INSERT INTO sot_project_members (project_id, source_name, model_group_id, mapping_status)
        VALUES (?, ?, ?, ?)
      `);
      for (const project of projects) {
        upsertProject.run(project.externalKey, project.fy, project.projectName, project.projectLink, startedAt, startedAt);
        const row = selectProject.get(project.externalKey) as { id: number };
        clearMembers.run(row.id);
        for (const sourceName of project.members) {
          const model = selectModel.get(sourceName) as { id: number } | undefined;
          if (!model) unmatched.add(sourceName);
          insertMember.run(row.id, sourceName, model?.id ?? null, model ? "matched" : "needs_mapping");
        }
      }
      db.prepare("UPDATE sot_projects SET is_active = 0 WHERE last_seen_at < ?").run(startedAt);
      db.prepare(`
        UPDATE sot_sync_runs
        SET finished_at = ?, status = 'success', project_count = ?, member_count = ?
        WHERE id = ?
      `).run(new Date().toISOString(), projects.length, projects.reduce((total, project) => total + project.members.length, 0), runId);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return {
      projectCount: projects.length,
      memberCount: projects.reduce((total, project) => total + project.members.length, 0),
      unmatchedMembers: [...unmatched].sort(),
    };
  } catch (error) {
    db.prepare("UPDATE sot_sync_runs SET finished_at = ?, status = 'failed', error_message = ? WHERE id = ?")
      .run(new Date().toISOString(), error instanceof Error ? error.message : "Gagal sinkronisasi SOT.", runId);
    throw error;
  }
}

export function getLastSotSync() {
  ensureTables();
  return getDb()
    .prepare("SELECT started_at, finished_at, status, project_count, member_count, error_message FROM sot_sync_runs ORDER BY id DESC LIMIT 1")
    .get() as
    | { started_at: string; finished_at: string | null; status: string; project_count: number; member_count: number; error_message: string | null }
    | undefined;
}
