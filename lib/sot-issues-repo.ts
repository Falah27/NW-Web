import { getDb } from "./db";
import { fetchAllIssues, parseFieldIds, parseQuery, SotApiError, type SotApiConfig } from "./sot-issues-api";
import { mapSotModelValue, readSotModelMap } from "./sot-model-map";

// Job/issue SOT yang dibaca langsung lewat REST API sesuai filter di .env.local, disimpan sebagai salinan
// lokal (cache). Salinan hanya diganti kalau SEMUA halaman berhasil dibaca; kalau gagal, data lama utuh.

export interface SotIssueColumn {
  id: string;
  label: string;
}

export interface SotIssueRow {
  id: number;
  tracker: string;
  status: string;
  subject: string;
  assignedTo: string;
  updatedOn: string;
  updatedLabel: string;
  completionDate: string | null;
  judgement: "late" | "due_today" | "on_schedule" | "completed" | "unknown";
  fixedVersion: string;
  project: string;
  fields: Record<string, string>;
}

export interface SotIssueData {
  issues: SotIssueRow[];
  columns: SotIssueColumn[];
  issueBaseUrl: string | null; // tanpa API key; dipakai untuk tautan ke halaman issue di SOT
  filterSummary: string | null;
  lastSyncAt: string | null;
  canSync: boolean;
  configProblem: string | null;
}

const globalForSync = globalThis as unknown as { __sotIssueSync?: boolean };

const STATUS_LABELS: Record<string, string> = {
  実装: "Implementation",
  構想設計: "Concept Design",
  "構想設計(総合テスト)": "Concept Design (Integration Test)",
  "構想設計(総合テスト) - 承認待ち": "Concept Design (Integration Test) - Pending Approval",
  総合テスト: "Integration Test",
  詳細設計: "Detailed Design",
};

const TRACKER_LABELS: Record<string, string> = {
  "Beta前テスト": "Pre-Beta Test",
  "FC前テスト": "Pre-FC Test",
  要件: "Requirement",
  要求: "Request",
};

function translateLabel(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value;
}

const FIELD_LABELS: Record<string, string> = {
  "\u5bfe\u8c61\u6a5f\u7a2e": "Target Model",
  "[\u69cb\u60f3\u8a2d\u8a08]\u5b8c\u4e86\u4e88\u5b9a\u65e5": "[Concept Design] Planned Completion Date",
  "[\u69cb\u60f3\u8a2d\u8a08(\u7dcf\u5408\u30c6\u30b9\u30c8)]\u5b8c\u4e86\u4e88\u5b9a\u65e5": "[Concept Design (Integration Test)] Planned Completion Date",
  "[\u8a73\u7d30\u8a2d\u8a08]\u5b8c\u4e86\u4e88\u5b9a\u65e5": "[Detailed Design] Planned Completion Date",
  "[\u5b9f\u88c5]\u5b8c\u4e86\u4e88\u5b9a\u65e5": "[Implementation] Planned Completion Date",
  "[\u5358\u4f53\u30c6\u30b9\u30c8]\u5b8c\u4e86\u4e88\u5b9a\u65e5": "[Unit Test] Planned Completion Date",
  "[\u7dcf\u5408\u30c6\u30b9\u30c8]\u5b8c\u4e86\u4e88\u5b9a\u65e5": "[Integration Test] Planned Completion Date",
  "\u898b\u7a4d\u3082\u308a\u5de5\u6570(\u4eba\u65e5)": "Estimated Effort (Person-Days)",
};

function translateFieldLabel(value: string): string {
  return FIELD_LABELS[value] ?? value;
}

const COMPLETION_FIELD_BY_STATUS: Record<string, string> = {
  "Concept Design": "6",
  "Concept Design (Integration Test)": "9",
  "Detailed Design": "12",
  "Implementation": "18",
  "Unit Test": "21",
  "Integration Test": "24",
};

function todayInJakarta(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function normalizeDate(value: string | undefined): string | null {
  const date = value?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function getCompletionDate(status: string, fields: Record<string, string>): string | null {
  const baseStatus = status.replace(/\s*-\s*Pending Approval\s*$/i, "").trim();
  const fieldId = COMPLETION_FIELD_BY_STATUS[baseStatus];
  return fieldId ? normalizeDate(fields[fieldId]) : null;
}

function judgeCompletionDate(status: string, completionDate: string | null, today: string): SotIssueRow["judgement"] {
  if (/^(Finish|Completed|完了)$/i.test(status.trim())) return "completed";
  if (!completionDate) return "unknown";
  if (completionDate < today) return "late";
  if (completionDate === today) return "due_today";
  return "on_schedule";
}

function ensureTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS sot_issues (
      id INTEGER PRIMARY KEY,
      tracker TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      updated_on TEXT NOT NULL DEFAULT '',
      fixed_version TEXT NOT NULL DEFAULT '',
      project TEXT NOT NULL DEFAULT '',
      fields_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS sot_issue_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/** Baca konfigurasi dari env. API key hanya ada di sini (sisi server) dan tidak pernah dikirim ke browser. */
export function readSotIssueConfig(): { config: SotApiConfig | null; problem: string | null } {
  try {
    const apiKey = process.env.SOT_API_KEY?.trim() ?? "";
    if (!apiKey) throw new SotApiError("SOT_API_KEY belum diisi di .env.local.");

    let baseUrl = process.env.SOT_API_BASE?.trim() ?? "";
    if (!baseUrl) {
      const projectsUrl = process.env.SOT_PROJECTS_URL?.trim();
      if (!projectsUrl) throw new SotApiError("SOT_API_BASE belum diisi di .env.local (contoh: https://host/redmine2/sot).");
      baseUrl = projectsUrl.replace(/\/+$/, "").replace(/\/projects$/, "");
    }
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new SotApiError("SOT_API_BASE bukan alamat yang valid.");
    }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
      throw new SotApiError("SOT_API_BASE harus https:// karena API key dikirim di header.");
    }

    const query = process.env.SOT_ISSUE_QUERY?.trim() ?? "status_id=open";
    parseQuery(query); // validasi lebih awal supaya pesan errornya jelas
    const fieldIds = parseFieldIds(process.env.SOT_ISSUE_FIELDS ?? "");

    const timeoutRaw = process.env.SOT_API_TIMEOUT_MS?.trim();
    let timeoutMs = 60_000;
    if (timeoutRaw) {
      timeoutMs = Number(timeoutRaw);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 5_000 || timeoutMs > 300_000) {
        throw new SotApiError("SOT_API_TIMEOUT_MS harus angka 5000 sampai 300000 (milidetik).");
      }
    }

    return {
      config: { baseUrl, apiKey, project: process.env.SOT_ISSUE_PROJECT?.trim() ?? "", query, fieldIds, timeoutMs },
      problem: null,
    };
  } catch (error) {
    if (error instanceof SotApiError) return { config: null, problem: error.message };
    throw error;
  }
}

function setMeta(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO sot_issue_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM sot_issue_meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Baca dari SOT lalu ganti salinan lokal dalam satu transaksi. Melempar SotApiError dengan pesan yang aman ditampilkan. */
export async function syncSotIssues(): Promise<{ count: number; pages: number }> {
  const { config, problem } = readSotIssueConfig();
  if (!config) throw new SotApiError(problem ?? "Konfigurasi SOT belum lengkap.");
  if (globalForSync.__sotIssueSync) throw new SotApiError("Sinkron issue SOT sedang berjalan. Tunggu sampai selesai.");

  globalForSync.__sotIssueSync = true;
  try {
    const result = await fetchAllIssues(config);

    ensureTables();
    const db = getDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DELETE FROM sot_issues");
      const insert = db.prepare(
        `INSERT INTO sot_issues (id, tracker, status, subject, assigned_to, updated_on, fixed_version, project, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const issue of result.issues) {
        insert.run(
          issue.id,
          issue.tracker,
          issue.status,
          issue.subject,
          issue.assignedTo,
          issue.updatedOn,
          issue.fixedVersion,
          issue.project,
          JSON.stringify(issue.fields)
        );
      }
      setMeta("synced_at", new Date().toISOString());
      setMeta("field_ids", JSON.stringify(config.fieldIds));
      setMeta("field_names", JSON.stringify(result.fieldNames));
      setMeta("base_url", config.baseUrl.replace(/\/+$/, ""));
      setMeta("filter_summary", [config.project && `project=${config.project}`, config.query].filter(Boolean).join(" · "));
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return { count: result.issues.length, pages: result.pages };
  } finally {
    globalForSync.__sotIssueSync = false;
  }
}

// Zona waktu tetap supaya tampilan konsisten (sama seperti halaman SOT Job).
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return iso && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : iso;
}

export function getSotIssueData(): SotIssueData {
  ensureTables();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, tracker, status, subject, assigned_to, updated_on, fixed_version, project, fields_json
       FROM sot_issues ORDER BY id DESC`
    )
    .all() as unknown as {
    id: number;
    tracker: string;
    status: string;
    subject: string;
    assigned_to: string;
    updated_on: string;
    fixed_version: string;
    project: string;
    fields_json: string;
  }[];

  const fieldIds = parseJson<number[]>(getMeta("field_ids"), []);
  const fieldNames = parseJson<Record<string, string>>(getMeta("field_names"), {});
  const modelMap = readSotModelMap();
  const modelFieldId = process.env.SOT_MODEL_FIELD_ID?.trim() || "1";
  const today = todayInJakarta();
  const { config, problem } = readSotIssueConfig();

  return {
    issues: rows.map((row) => {
      const status = translateLabel(row.status, STATUS_LABELS);
      const fields = parseJson<Record<string, string>>(row.fields_json, {});
      const completionDate = getCompletionDate(status, fields);
      if (fields[modelFieldId]) fields[modelFieldId] = mapSotModelValue(fields[modelFieldId], modelMap);
      return {
        id: row.id,
        tracker: translateLabel(row.tracker, TRACKER_LABELS),
        status,
        subject: row.subject,
        assignedTo: row.assigned_to,
        updatedOn: row.updated_on,
        updatedLabel: formatDate(row.updated_on),
        completionDate,
        judgement: judgeCompletionDate(status, completionDate, today),
        fixedVersion: row.fixed_version,
        project: row.project,
        fields,
      };
    }),
    columns: fieldIds.map((id) => ({ id: String(id), label: translateFieldLabel(fieldNames[String(id)] ?? `CF_${id}`) })),
    issueBaseUrl: getMeta("base_url"),
    filterSummary: getMeta("filter_summary"),
    lastSyncAt: getMeta("synced_at"),
    canSync: config !== null,
    configProblem: problem,
  };
}
