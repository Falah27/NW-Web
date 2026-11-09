import path from "node:path";
import { getDb } from "./db";
import { chromium, type BrowserContext, type Page } from "playwright";
import { buildModelPrefixes } from "./sot-prefix-repo";
import { cleanPrefixes } from "./sot-prefix";

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
  prefixMappedMembers: number;
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
const SOT_HOST = new URL(PROJECTS_URL).hostname.toLowerCase();
const NAVIGATION_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function sanitizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function normalizePathname(value: string): string {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, "");
    return pathname || "/";
  } catch {
    return "";
  }
}

function isSameTargetPage(currentUrl: string, targetUrl: string): boolean {
  return (
    getHostname(currentUrl) === getHostname(targetUrl) &&
    normalizePathname(currentUrl) === normalizePathname(targetUrl)
  );
}

function isSotHost(value: string): boolean {
  return getHostname(value) === SOT_HOST;
}

function isMicrosoftLoginHost(value: string): boolean {
  const host = getHostname(value);
  return host === "login.microsoftonline.com" || host === "login.live.com" || host.endsWith(".msftauth.net");
}

function logSot(message: string, details?: Record<string, unknown>) {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.info(`[SOT] ${message}${suffix}`);
}

function logSotError(message: string, error: unknown, details?: Record<string, unknown>) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[SOT] ${message}`, { ...details, error: errorMessage });
}

async function hasProjectsHeader(page: Page): Promise<boolean> {
  if (page.isClosed()) return false;
  try {
    return await page.locator("h2").evaluateAll((headers) =>
      headers.some((header) => (header.textContent ?? "").replace(/\s+/g, " ").trim() === "Projects")
    );
  } catch {
    return false;
  }
}

async function pageHasBody(page: Page): Promise<boolean> {
  if (page.isClosed()) return false;
  try {
    const body = page.locator("body");
    if ((await body.count()) === 0) return false;
    const text = await body.innerText({ timeout: 3_000 }).catch(() => "");
    return text.trim().length > 0;
  } catch {
    return false;
  }
}

async function findCompanyAccountLink(page: Page) {
  if (page.isClosed()) return null;
  const link = page.getByRole("link", { name: /login\s+with\s+companyaccount/i }).first();
  try {
    return (await link.count()) > 0 ? link : null;
  } catch {
    return null;
  }
}

function attachPageLogging(page: Page): void {
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "Unknown request failure";
    if (errorText === "net::ERR_ABORTED") return;
    logSotError("Request SOT gagal", new Error(errorText), {
      method: request.method(),
      resource: request.resourceType(),
      host: getHostname(request.url()),
      url: sanitizeUrl(request.url()),
    });
  });
}

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
    CREATE TABLE IF NOT EXISTS sot_model_mappings (
      source_name TEXT PRIMARY KEY COLLATE NOCASE,
      model_group_id INTEGER NOT NULL REFERENCES model_groups(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function parseMembers(text: string): string[] {
  const labelIndex = text.indexOf(TARGET_MODEL_LABEL);
  if (labelIndex < 0) return [];

  const value = text.slice(labelIndex + TARGET_MODEL_LABEL.length, labelIndex + TARGET_MODEL_LABEL.length + 240);
  const cleaned = value.replace(/^[\s:：-]+/, "").split(/\s{2,}|(?:\b(?:担当|責任|Status|更新)\b)/i)[0].trim();
  return cleaned
    .split(/[、,，;；|/]/)
    .map((member) => member.trim())
    .filter(Boolean);
}

async function openBrowserPage(context: BrowserContext, url: string, expectProjectsHeader = false): Promise<Page> {
  const originalPage = await context.newPage();
  attachPageLogging(originalPage);
  let activePage = originalPage;
  logSot("Membuka halaman", { url: sanitizeUrl(url) });

  try {
    await originalPage.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
  } catch (error) {
    logSotError("Navigasi awal belum selesai", error, {
      requestedUrl: sanitizeUrl(url),
      currentUrl: sanitizeUrl(originalPage.url()),
    });
  }

  const initialReady =
    isSameTargetPage(originalPage.url(), url) &&
    isSotHost(originalPage.url()) &&
    (expectProjectsHeader ? await hasProjectsHeader(originalPage) : await pageHasBody(originalPage));
  if (initialReady) {
    logSot("Halaman SOT siap", { url: sanitizeUrl(originalPage.url()) });
    return originalPage;
  }

  const companyAccountLink = await findCompanyAccountLink(originalPage);
  if (companyAccountLink) {
    logSot("Login Company Account terdeteksi, mengeklik", { url: sanitizeUrl(originalPage.url()) });
    const popupPromise = context.waitForEvent("page", { timeout: 5_000 }).catch(() => undefined);
    try {
      await companyAccountLink.click({ noWaitAfter: true });
    } catch (error) {
      logSotError("Gagal mengeklik Login with CompanyAccount", error, {
        url: sanitizeUrl(originalPage.url()),
      });
      await originalPage.close().catch(() => undefined);
      throw new Error("Gagal mengeklik Login with CompanyAccount.");
    }

    const popup = await popupPromise;
    if (popup && popup !== originalPage) {
      activePage = popup;
      attachPageLogging(activePage);
      logSot("SSO dibuka pada popup", { url: sanitizeUrl(activePage.url()) });
      await activePage.waitForLoadState("domcontentloaded", { timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
    } else {
      logSot("Menunggu redirect Microsoft SSO", { url: sanitizeUrl(activePage.url()) });
    }
  }

  const startedAt = Date.now();
  let targetNavigationAttempted = false;
  let lastLoggedHost = "";
  while (Date.now() - startedAt < LOGIN_TIMEOUT_MS) {
    if (activePage.isClosed()) {
      if (activePage !== originalPage && !originalPage.isClosed()) activePage = originalPage;
      else throw new Error("Tab browser tertutup ketika menunggu login SSO.");
    }

    const currentUrl = activePage.url();
    const currentHost = getHostname(currentUrl);
    if (currentHost !== lastLoggedHost) {
      logSot("Status navigasi SSO", { host: currentHost || "unknown", url: sanitizeUrl(currentUrl) });
      lastLoggedHost = currentHost;
    }

    const targetReady =
      isSotHost(currentUrl) &&
      isSameTargetPage(currentUrl, url) &&
      (expectProjectsHeader ? await hasProjectsHeader(activePage) : await pageHasBody(activePage));
    if (targetReady) {
      const title = await activePage.title().catch(() => "");
      logSot("Halaman SOT siap", { url: sanitizeUrl(currentUrl), title });
      if (activePage !== originalPage && !originalPage.isClosed()) await originalPage.close().catch(() => undefined);
      return activePage;
    }

    if (isSotHost(currentUrl) && !isSameTargetPage(currentUrl, url) && !targetNavigationAttempted) {
      targetNavigationAttempted = true;
      logSot("Kembali ke domain SOT, membuka ulang halaman target", {
        target: sanitizeUrl(url),
        current: sanitizeUrl(currentUrl),
      });
      await activePage.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS }).catch((error) => {
        logSotError("Gagal membuka ulang halaman target", error, {
          target: sanitizeUrl(url),
          current: sanitizeUrl(activePage.url()),
        });
      });
    }

    if (isSotHost(currentUrl)) {
      const loginLink = await findCompanyAccountLink(activePage);
      if (loginLink) {
        logSot("Halaman login SOT muncul kembali, mengeklik Company Account");
        await loginLink.click({ noWaitAfter: true }).catch((error) => {
          logSotError("Klik ulang Company Account gagal", error);
        });
      }
    }
    await delay(POLL_INTERVAL_MS);
  }

  const finalUrl = activePage.url();
  const finalTitle = await activePage.title().catch(() => "");
  const message = isMicrosoftLoginHost(finalUrl)
    ? "Microsoft Sign In belum selesai. Selesaikan login atau MFA pada Edge, lalu jalankan sinkronisasi kembali."
    : isSotHost(finalUrl)
      ? expectProjectsHeader
        ? "Domain SOT berhasil dibuka, tetapi header Projects tidak ditemukan."
        : "Domain SOT berhasil dibuka, tetapi halaman project belum siap."
      : "Login SOT belum kembali ke domain SOT. Periksa koneksi LAN, VPN, proxy perusahaan, atau Microsoft SSO.";
  logSotError("Login Company Account belum selesai", new Error(message), {
    host: getHostname(finalUrl),
    url: sanitizeUrl(finalUrl),
    title: finalTitle,
    timeoutSeconds: LOGIN_TIMEOUT_MS / 1000,
  });
  await activePage.close().catch(() => undefined);
  if (activePage !== originalPage && !originalPage.isClosed()) await originalPage.close().catch(() => undefined);
  throw new Error(message);
}

async function loadProjects(context: BrowserContext): Promise<ParsedProject[]> {
  const page = await openBrowserPage(context, PROJECTS_URL, true);
  try {
    logSot("Membaca daftar project", { url: sanitizeUrl(page.url()) });
    const projects = await page.evaluate(() => {
      const results: ParsedProject[] = [];
      const projectsHeader = Array.from(document.querySelectorAll("h2")).find(
        (header) => (header.textContent ?? "").replace(/\s+/g, " ").trim() === "Projects"
      );
      if (!projectsHeader) return results;

      const fyItems: HTMLLIElement[] = [];
      let sibling = projectsHeader.nextElementSibling;
      while (sibling && sibling.tagName.toUpperCase() !== "H2") {
        if (sibling.matches("li.child")) fyItems.push(sibling as HTMLLIElement);
        fyItems.push(...Array.from(sibling.querySelectorAll<HTMLLIElement>("li.child")));
        sibling = sibling.nextElementSibling;
      }
      if (fyItems.length === 0) {
        fyItems.push(...Array.from(projectsHeader.parentElement?.querySelectorAll<HTMLLIElement>("li.child") ?? []));
      }

      const seen = new Set<string>();
      for (const fyItem of fyItems) {
        const fyLink = fyItem.querySelector<HTMLAnchorElement>("a.project.child.parent");
        if (!fyLink) continue;
        const fy = (fyLink.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!/^FY/i.test(fy)) continue;
        for (const projectLink of fyItem.querySelectorAll<HTMLAnchorElement>("a.project.leaf")) {
          const projectName = (projectLink.textContent ?? "").replace(/\s+/g, " ").trim();
          if (!projectName || !projectLink.href) continue;
          const parsedUrl = new URL(projectLink.href);
          const externalKey = parsedUrl.pathname.replace(/\/+$/, "");
          if (!externalKey || seen.has(externalKey)) continue;
          seen.add(externalKey);
          results.push({ externalKey, fy: fy.toUpperCase(), projectName, projectLink: projectLink.href, members: [] });
        }
      }
      return results;
    });
    if (projects.length === 0) {
      throw new Error("Tidak menemukan link project SOT. Header Projects ditemukan, tetapi struktur a.project.leaf tidak tersedia.");
    }
    logSot("Daftar project berhasil dibaca", { count: projects.length });
    return projects;
  } catch (error) {
    logSotError("Gagal membaca daftar project", error, { url: sanitizeUrl(page.url()) });
    throw error;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function readProjectMembers(page: Page): Promise<string[]> {
  const rawValue = await page.locator("li").evaluateAll((items, targetLabel) => {
    for (const item of items) {
      if (item.querySelector("li")) continue;
      const text = (item.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text.includes(String(targetLabel))) continue;
      const separatorIndex = text.search(/[:：]/);
      if (separatorIndex < 0) continue;
      return text.slice(separatorIndex + 1).trim();
    }
    return "";
  }, TARGET_MODEL_LABEL);
  if (!rawValue) return [];
  return rawValue.split(/[、,，;；|/]/).map((member) => member.trim()).filter(Boolean);
}

export async function syncSotProjects(): Promise<SotSyncResult> {
  ensureTables();
  const db = getDb();
  const startedAt = new Date().toISOString();
  const run = db
    .prepare("INSERT INTO sot_sync_runs (started_at, status) VALUES (?, 'running')")
    .run(startedAt);
  const runId = Number(run.lastInsertRowid);
  let context: BrowserContext | undefined;

  try {
    const headless = process.env.SOT_BROWSER_HEADLESS !== "false";
    const profileDirectory =
      process.env.SOT_BROWSER_PROFILE_DIR?.trim() || path.join(process.cwd(), ".playwright", "edge-sot-profile");
    logSot("Memulai sinkronisasi", {
      browser: process.env.SOT_BROWSER_CHANNEL ?? "msedge",
      headless,
      profileDirectory,
    });
    context = await chromium.launchPersistentContext(profileDirectory, {
      channel: process.env.SOT_BROWSER_CHANNEL ?? "msedge",
      headless,
      viewport: null,
      timeout: LOGIN_TIMEOUT_MS,
      args: ["--no-first-run", "--no-default-browser-check", "--disable-extensions"],
    });
    if (process.env.SOT_COOKIE?.trim()) {
      await context.setExtraHTTPHeaders({ Cookie: process.env.SOT_COOKIE.trim() });
      logSot("SOT_COOKIE diterapkan dari environment");
    }
    const projects = await loadProjects(context);
    for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
      const project = projects[projectIndex];
      logSot("Membaca target model project", {
        index: projectIndex + 1,
        total: projects.length,
        project: project.projectName,
      });
      const page = await openBrowserPage(context, project.projectLink, false);
      try {
        project.members = await readProjectMembers(page);
        if (project.members.length === 0) {
          project.members = parseMembers(await page.locator("body").innerText());
        }
        logSot("Target model project berhasil dibaca", {
          project: project.projectName,
          count: project.members.length,
        });
      } catch (error) {
        logSotError("Gagal membaca target model project", error, {
          project: project.projectName,
          url: project.projectLink,
        });
        throw error;
      } finally {
        await page.close();
      }
    }

    const unmatched = new Set<string>();
    let prefixMappedMembers = 0;
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
      const selectMapping = db.prepare(`
        SELECT model_group_id AS id
        FROM sot_model_mappings
        WHERE source_name = ?
      `);
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
          let model = selectModel.get(sourceName) as { id: number } | undefined;
          if (!model) {
            model = selectMapping.get(sourceName) as { id: number } | undefined;
          }
          if (!model) {
            const prefix = cleanPrefixes(sourceName)[0];
            if (prefix) {
              model = selectModel.get(prefix) as { id: number } | undefined;
              if (model) prefixMappedMembers += 1;
            }
          }
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
    buildModelPrefixes();
    logSot("Sinkronisasi selesai", {
      projects: projects.length,
      members: projects.reduce((total, project) => total + project.members.length, 0),
      prefixMappedMembers,
      unmatchedMembers: unmatched.size,
    });

    return {
      projectCount: projects.length,
      memberCount: projects.reduce((total, project) => total + project.members.length, 0),
      unmatchedMembers: [...unmatched].sort(),
      prefixMappedMembers,
    };
  } catch (error) {
    logSotError("Sinkronisasi gagal", error, { runId });
    db.prepare("UPDATE sot_sync_runs SET finished_at = ?, status = 'failed', error_message = ? WHERE id = ?")
      .run(new Date().toISOString(), error instanceof Error ? error.message : "Gagal sinkronisasi SOT.", runId);
    throw error;
  } finally {
    if (context) {
      logSot("Menutup browser SOT");
      await context.close().catch((error) => {
        logSotError("Gagal menutup browser SOT", error);
      });
    }
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
