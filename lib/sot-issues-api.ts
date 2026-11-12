// Pembaca issue SOT lewat REST API Redmine (issues.json) memakai API key.
// File ini sengaja TANPA import: tidak menyentuh database dan bisa dites langsung dengan `node --test`.

export const PAGE_LIMIT = 100; // batas maksimum Redmine per permintaan
const MAX_PAGES = 500; // pengaman: maksimal 50.000 issue per sinkron

export interface SotIssue {
  id: number;
  tracker: string;
  status: string;
  subject: string;
  assignedTo: string;
  updatedOn: string; // ISO 8601 dari SOT
  fixedVersion: string;
  project: string;
  fields: Record<string, string>; // id custom field -> nilai (beberapa nilai digabung dengan ", ")
}

export interface SotApiConfig {
  baseUrl: string; // mis. https://host/redmine2/sot
  apiKey: string;
  project: string; // identifier project (boleh kosong = semua project)
  query: string; // filter tambahan, mis. "status_id=open&cf_3=659"
  fieldIds: number[]; // custom field yang diambil, urutannya dipakai sebagai urutan kolom
  timeoutMs: number;
}

export interface SotIssueResult {
  issues: SotIssue[];
  totalCount: number;
  pages: number;
  fieldNames: Record<string, string>; // id custom field -> nama dari SOT
}

/** Error yang pesannya aman ditampilkan ke pengguna (tidak pernah memuat API key). */
export class SotApiError extends Error {}

const FORBIDDEN_QUERY_KEYS = new Set(["key", "limit", "offset", "project_id", "format"]);

/** "1, 6 9" -> [1, 6, 9]. Angka ganda dibuang, urutan dipertahankan. */
export function parseFieldIds(raw: string): number[] {
  const ids: number[] = [];
  for (const part of raw.split(/[\s,]+/).filter(Boolean)) {
    if (!/^\d{1,6}$/.test(part)) throw new SotApiError(`SOT_ISSUE_FIELDS tidak valid: "${part}" bukan angka (contoh: 1,6,9).`);
    const id = Number(part);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Filter tambahan dari env. Hanya karakter aman, dan parameter yang diatur aplikasi tidak boleh ditimpa. */
export function parseQuery(raw: string): URLSearchParams {
  const params = new URLSearchParams(raw.trim().replace(/^\?/, ""));
  for (const [key, value] of params) {
    if (!/^[A-Za-z0-9_.:[\]]+$/.test(key) || key.length > 60) {
      throw new SotApiError(`SOT_ISSUE_QUERY tidak valid: nama parameter "${key.slice(0, 30)}" memuat karakter yang tidak diizinkan.`);
    }
    if (FORBIDDEN_QUERY_KEYS.has(key.toLowerCase())) {
      throw new SotApiError(`SOT_ISSUE_QUERY tidak boleh memuat "${key}" (diatur otomatis oleh aplikasi).`);
    }
    if (value.length > 200) throw new SotApiError(`SOT_ISSUE_QUERY: nilai "${key}" terlalu panjang.`);
  }
  return params;
}

export function buildIssuesApiUrl(config: SotApiConfig, offset: number): string {
  const url = new URL(config.baseUrl.replace(/\/+$/, "") + "/issues.json");
  const p = url.searchParams;
  if (config.project) p.set("project_id", config.project);
  for (const [key, value] of parseQuery(config.query)) p.append(key, value);
  if (!p.has("sort")) p.set("sort", "id:desc"); // urutan tetap supaya paging tidak melompat
  p.set("limit", String(PAGE_LIMIT));
  p.set("offset", String(offset));
  return url.toString();
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "object" && "name" in value) return text((value as { name: unknown }).name);
  return "";
}

function field(obj: unknown, key: string): unknown {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}

/** Satu issue mentah dari SOT -> bentuk yang dipakai aplikasi. null kalau id-nya tidak valid. */
export function normalizeIssue(raw: unknown, fieldIds: number[], fieldNames: Record<string, string>): SotIssue | null {
  const id = Number(field(raw, "id"));
  if (!Number.isInteger(id) || id <= 0) return null;

  const wanted = new Set(fieldIds);
  const fields: Record<string, string> = {};
  const custom = field(raw, "custom_fields");
  if (Array.isArray(custom)) {
    for (const cf of custom) {
      const cfId = Number(field(cf, "id"));
      if (!wanted.has(cfId)) continue;
      fields[String(cfId)] = text(field(cf, "value"));
      const name = text(field(cf, "name"));
      if (name && !fieldNames[String(cfId)]) fieldNames[String(cfId)] = name;
    }
  }

  return {
    id,
    tracker: text(field(raw, "tracker")),
    status: text(field(raw, "status")),
    subject: text(field(raw, "subject")),
    assignedTo: text(field(raw, "assigned_to")),
    updatedOn: text(field(raw, "updated_on")),
    fixedVersion: text(field(raw, "fixed_version")),
    project: text(field(raw, "project")),
    fields,
  };
}

const CERT_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
]);

function explainNetworkError(error: unknown, timeoutMs: number): string {
  const name = field(error, "name");
  if (name === "TimeoutError" || name === "AbortError") {
    return `SOT tidak menjawab dalam ${Math.round(timeoutMs / 1000)} detik. Naikkan SOT_API_TIMEOUT_MS atau persempit filter.`;
  }
  const code = String(field(field(error, "cause"), "code") ?? "");
  if (CERT_CODES.has(code)) {
    return (
      `Sertifikat HTTPS SOT tidak dipercaya oleh Node.js (${code}). Set NODE_EXTRA_CA_CERTS ke file sertifikat root perusahaan (.pem) lalu restart, ` +
      `atau jalankan Node 22.15+ dengan --use-system-ca. Jangan mematikan verifikasi sertifikat.`
    );
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "Alamat SOT tidak ditemukan (DNS). Pastikan komputer ini terhubung ke jaringan perusahaan atau VPN, dan SOT_API_BASE benar.";
  }
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) {
    return `Tidak bisa terhubung ke SOT (${code}). Cek jaringan atau VPN.`;
  }
  return "Gagal menghubungi SOT" + (code ? ` (${code})` : "") + ".";
}

async function requestJson(url: string, config: SotApiConfig, fetchImpl: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { "X-Redmine-API-Key": config.apiKey, Accept: "application/json" },
      redirect: "manual", // jangan ikuti pengalihan: API key tidak boleh ikut terkirim ke alamat lain
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new SotApiError(explainNetworkError(error, config.timeoutMs));
  }

  if (res.status >= 300 && res.status < 400) {
    throw new SotApiError("SOT mengalihkan permintaan (kemungkinan ke halaman login). Periksa SOT_API_KEY dan SOT_API_BASE.");
  }
  if (res.status === 401) throw new SotApiError("API key ditolak SOT (401). Periksa SOT_API_KEY di .env.local dan pastikan REST API aktif untuk akunmu.");
  if (res.status === 403) throw new SotApiError("Akses ditolak SOT (403). Akunmu tidak punya izin untuk project atau filter ini.");
  if (res.status === 404) throw new SotApiError("Project atau alamat tidak ditemukan (404). Periksa SOT_ISSUE_PROJECT dan SOT_API_BASE.");
  if (res.status === 422) throw new SotApiError("SOT menolak filter (422). Periksa SOT_ISSUE_QUERY.");
  if (!res.ok) throw new SotApiError(`SOT membalas HTTP ${res.status}.`);

  try {
    return await res.json();
  } catch {
    throw new SotApiError("Balasan SOT bukan JSON (mungkin halaman login). Periksa SOT_API_KEY dan SOT_API_BASE.");
  }
}

/**
 * Ambil SEMUA halaman. Kalau satu halaman gagal, seluruhnya gagal (tidak ada hasil setengah jadi).
 * Maju berdasarkan jumlah issue yang benar-benar diterima, jadi aman kalau server mengembalikan kurang dari `limit`.
 * Hasil harus lengkap: jumlah issue unik harus sama dengan total_count, kalau tidak dibatalkan.
 */
export async function fetchAllIssues(config: SotApiConfig, fetchImpl: typeof fetch = fetch): Promise<SotIssueResult> {
  const byId = new Map<number, SotIssue>();
  const fieldNames: Record<string, string> = {};
  let offset = 0;
  let totalCount = 0;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const body = await requestJson(buildIssuesApiUrl(config, offset), config, fetchImpl);
    pages += 1;

    const raw = field(body, "issues");
    const total = Number(field(body, "total_count"));
    if (!Array.isArray(raw) || !Number.isFinite(total)) {
      throw new SotApiError("Balasan SOT tidak dikenali (tidak ada daftar issue atau total_count).");
    }
    totalCount = total;

    for (const item of raw) {
      const issue = normalizeIssue(item, config.fieldIds, fieldNames);
      if (issue) byId.set(issue.id, issue); // id ganda (data bergeser saat paging) cukup disimpan sekali
    }
    offset += raw.length;
    if (raw.length === 0 || offset >= totalCount) break;
  }
  if (offset < totalCount) throw new SotApiError(`Terlalu banyak issue (${totalCount}). Persempit filter di SOT_ISSUE_QUERY.`);

  // Paging berbasis offset bisa melewatkan issue kalau data di SOT bergeser saat dibaca. Hasil yang tidak lengkap
  // tidak boleh tampak lengkap, jadi batalkan (data lama tetap utuh) dan minta pengguna mengulang.
  if (byId.size !== totalCount) {
    throw new SotApiError(
      `Jumlah issue yang terbaca (${byId.size}) berbeda dari total di SOT (${totalCount}). Kemungkinan data berubah saat dibaca, coba sinkron lagi.`
    );
  }

  return { issues: [...byId.values()], totalCount, pages, fieldNames };
}
