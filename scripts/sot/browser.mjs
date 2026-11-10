// Lapisan browser untuk SOT. Logikanya mengikuti macro VBA SOTProjectModuleV7:
//   - satu sesi Edge, login satu kali (dan login ulang kalau sesi habis)
//   - daftar project dibaca dari DOM halaman "Projects"
//   - halaman project dibaca dengan fetch() DI DALAM tab SOT (bukan membuka halaman satu-satu)
// File ini tidak menyentuh database. Hasilnya dikembalikan sebagai objek biasa.
import { chromium } from "playwright-core";

const WAIT_MS = 15_000; // batas tunggu halaman target
const LOGIN_WAIT_MS = 30_000; // batas tunggu link login / halaman target setelah login
const POLL_MS = 500;
export const FETCH_CHUNK = 25; // halaman project per panggilan browser
const FETCH_CONCURRENCY = 6;
const LOGIN_TEXT = "login with companyaccount";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sameUrl(a, b) {
  const clean = (u) => u.trim().toLowerCase().replace(/\/+$/, "");
  return clean(a) === clean(b);
}

/** Buka Edge dengan profil tetap (login SSO tersimpan di profil, tanpa menyimpan password). */
export async function openSession({ profileDir, headless, executablePath, projectsUrl, log }) {
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      ...(executablePath ? { executablePath } : { channel: "msedge" }),
      headless,
      args: ["--no-first-run", "--no-default-browser-check", "--hide-crash-restore-bubble"],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(
      `Edge tidak bisa dibuka (${reason}). Pastikan Microsoft Edge terpasang dan tidak ada jendela Edge SOT lain yang masih terbuka.`
    );
  }

  const page = context.pages()[0] ?? (await context.newPage());
  // Tab yang tidak sengaja dibuka (restore tab, popup) ditutup, seperti KillUnintendedTabs di VBA.
  for (const extra of context.pages()) if (extra !== page) await extra.close().catch(() => {});
  context.on("page", (p) => {
    if (p !== page) p.close().catch(() => {});
  });

  return { context, page, projectsUrl, host: new URL(projectsUrl).hostname.toLowerCase(), log };
}

export async function closeSession(session) {
  await session?.context?.close().catch(() => {});
}

// Satu pengecekan keadaan halaman. null = halaman sedang berpindah.
async function probe(session) {
  try {
    return await session.page.evaluate(
      ({ host, loginText }) => {
        const h = location.hostname.toLowerCase();
        const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
        const hasLoginLink = Array.from(document.querySelectorAll("a")).some((a) =>
          norm(a.textContent).toLowerCase().includes(loginText)
        );
        return {
          href: location.href,
          onHost: h === host || h.startsWith(host + ".") || host.startsWith(h + "."),
          ready: Array.from(document.querySelectorAll("h2")).some((x) => norm(x.textContent) === "Projects"),
          loginUrl: location.href.toLowerCase().includes("login"),
          hasLoginLink,
        };
      },
      { host: session.host, loginText: LOGIN_TEXT }
    );
  } catch {
    return null;
  }
}

async function clickLoginLink(session) {
  return session.page
    .evaluate((loginText) => {
      for (const a of Array.from(document.querySelectorAll("a"))) {
        const t = (a.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (t.includes(loginText)) {
          a.click();
          return true;
        }
      }
      return false;
    }, LOGIN_TEXT)
    .catch(() => false);
}

/**
 * Pastikan tab ada di halaman "Projects" dan sudah login.
 * Alur sama dengan OpenAndRead + ResolveLogin di VBA: buka URL, kalau diarahkan ke halaman login
 * klik "Login with CompanyAccount", tunggu, dan kalau mendarat di halaman lain buka URL sekali lagi.
 */
export async function ensureProjectsPage(session) {
  const { page, projectsUrl, log } = session;
  log("info", `Membuka ${projectsUrl}`);
  await page.goto(projectsUrl, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});

  let deadline = Date.now() + WAIT_MS;
  let clicked = false;
  let reopened = false;
  let last = null;

  while (Date.now() < deadline) {
    const s = await probe(session);
    if (s) {
      last = s;
      if (s.ready && s.onHost) {
        log("info", clicked ? "Login berhasil, halaman project siap" : "Halaman project siap");
        return;
      }
      if (!clicked && (s.loginUrl || s.hasLoginLink)) {
        deadline = Math.max(deadline, Date.now() + LOGIN_WAIT_MS);
        if (s.hasLoginLink && (await clickLoginLink(session))) {
          clicked = true;
          deadline = Date.now() + LOGIN_WAIT_MS;
          log("info", "Halaman login terdeteksi, link 'Login with CompanyAccount' diklik");
        }
      } else if (clicked && !reopened && s.onHost && !s.ready && !s.loginUrl && !sameUrl(s.href, projectsUrl)) {
        reopened = true; // setelah login mendarat di halaman lain
        log("info", "Mendarat di halaman lain setelah login, membuka halaman project lagi");
        await page.goto(projectsUrl, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
      }
    }
    await sleep(POLL_MS);
  }

  if (last?.loginUrl || last?.hasLoginLink) {
    throw new Error(
      "Login SOT belum selesai. Jalankan dengan SOT_HEADLESS kosong lalu selesaikan login CompanyAccount di jendela Edge."
    );
  }
  throw new Error(`Halaman project SOT tidak ditemukan (header 'Projects' tidak muncul). Terakhir di: ${last?.href ?? "-"}`);
}

/**
 * Baca blok "Projects". FY hanya dari <a class="project child parent"> yang teksnya diawali "FY";
 * project adalah semua <a class="project leaf"> di dalam <li> FY itu.
 * Hasil: [{ label, link, projects: [{ name, link }] }] (project yang sama hanya dihitung di FY pertama).
 */
export async function readProjectList(session) {
  const rows = await session.page.evaluate(() => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const heading = Array.from(document.querySelectorAll("h2")).find((h) => norm(h.textContent) === "Projects");
    if (!heading) return [];

    const items = [];
    let sibling = heading.nextElementSibling;
    while (sibling && sibling.tagName !== "H2") {
      if (sibling.matches("li.child")) items.push(sibling);
      sibling.querySelectorAll("li.child").forEach((li) => items.push(li));
      sibling = sibling.nextElementSibling;
    }
    if (items.length === 0 && heading.parentElement) {
      heading.parentElement.querySelectorAll("li.child").forEach((li) => items.push(li));
    }

    const out = [];
    for (const li of items) {
      let a = Array.from(li.children).find(
        (c) => c.tagName === "A" && c.classList.contains("project") && c.classList.contains("child") && c.classList.contains("parent")
      );
      if (!a) a = li.querySelector("a.project.child.parent");
      if (!a) continue;
      const label = norm(a.textContent);
      if (!/^FY/i.test(label)) continue;
      out.push({ type: "fy", text: label, href: a.href });
      li.querySelectorAll("a.project.leaf").forEach((leaf) => {
        out.push({ type: "project", text: norm(leaf.textContent), href: leaf.href });
      });
    }
    return out;
  });

  const fys = [];
  const seen = new Set();
  for (const row of rows) {
    if (row.type === "fy") {
      fys.push({ label: row.text, link: row.href, projects: [] });
    } else if (fys.length > 0 && row.href && row.text && !seen.has(row.href)) {
      seen.add(row.href);
      fys[fys.length - 1].projects.push({ name: row.text, link: row.href });
    }
  }
  return fys;
}

// Dijalankan DI DALAM tab SOT. Membaca banyak halaman project dengan fetch() (beberapa sekaligus),
// mencari <li> paling dalam yang memuat label target model, lalu mengambil teks setelah ":" atau "：".
async function fetchTargetModels({ urls, label, concurrency }) {
  const out = new Array(urls.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= urls.length) return;
      try {
        const r = await fetch(urls[i], { credentials: "same-origin", signal: AbortSignal.timeout(30_000) });
        if (r.url.toLowerCase().includes("login")) {
          out[i] = { status: "login" };
          continue;
        }
        if (!r.ok) {
          out[i] = { status: "http", message: "HTTP " + r.status };
          continue;
        }
        const doc = new DOMParser().parseFromString(await r.text(), "text/html");
        let value = null;
        for (const li of Array.from(doc.querySelectorAll("li"))) {
          if (li.querySelector("li")) continue;
          const text = (li.textContent || "").replace(/\s+/g, " ").trim();
          if (!text.includes(label)) continue;
          const at = text.search(/[:：]/);
          if (at < 0) continue;
          value = text.slice(at + 1).trim();
          break;
        }
        out[i] = value ? { status: "ok", value } : { status: "none" };
      } catch (e) {
        out[i] = { status: "error", message: String((e && e.message) || e) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}

/**
 * Baca target model semua target [{ key, link }] per FETCH_CHUNK halaman.
 * Kalau ada halaman yang meminta login (sesi habis), login ulang lalu ulangi kelompok itu satu kali.
 * Mengembalikan [{ key, status: ok|none|login|http|error, value?, message? }].
 */
export async function readTargetModels(session, targets, label, onProgress) {
  const results = [];
  for (let a = 0; a < targets.length; a += FETCH_CHUNK) {
    const chunk = targets.slice(a, a + FETCH_CHUNK);
    const run = () =>
      session.page.evaluate(fetchTargetModels, { urls: chunk.map((t) => t.link), label, concurrency: FETCH_CONCURRENCY });

    let statuses = await run();
    if (statuses.some((s) => s?.status === "login")) {
      session.log("warn", "Sesi SOT habis, login ulang");
      await ensureProjectsPage(session);
      statuses = await run();
    }
    chunk.forEach((t, i) => results.push({ key: t.key, ...(statuses[i] ?? { status: "error", message: "tidak ada hasil" }) }));
    onProgress?.(Math.min(a + chunk.length, targets.length), targets.length);
  }
  return results;
}
