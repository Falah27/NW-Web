import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { openSession, closeSession } from "./sot/browser.mjs";

const url = process.env.SOT_MODEL_MAP_URL?.trim();
if (!url) throw new Error("SOT_MODEL_MAP_URL belum diisi di .env.local.");

const fieldId = process.env.SOT_MODEL_FIELD_ID?.trim() || "1";
const selector = `input[type="checkbox"][name="issue[custom_field_values][${fieldId}][]"]`;
const outputPath = path.resolve(process.cwd(), process.env.SOT_MODEL_MAP_PATH?.trim() || "data/sot-model-map.json");
const log = (level, message) => console.log(`[${level}] ${message}`);

const session = await openSession({
  profileDir: process.env.SOT_BROWSER_PROFILE_DIR || process.env.SOT_PROFILE_DIR || path.join(process.cwd(), ".playwright", "edge-sot-profile"),
  headless: (process.env.SOT_BROWSER_HEADLESS || process.env.SOT_HEADLESS) === "true",
  executablePath: process.env.SOT_BROWSER_PATH || undefined,
  projectsUrl: url,
  log,
});

try {
  await session.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  console.log("Buka halaman SOT. Jika diminta login, selesaikan login di Edge yang terbuka.");
  await session.page.waitForSelector(selector, { timeout: 120_000 });

  const mapping = await session.page.evaluate((inputSelector) => {
    const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
    const result = {};
    for (const input of document.querySelectorAll(inputSelector)) {
      const value = normalize(input.getAttribute("value"));
      const label = input.closest("label");
      const name = normalize(label?.textContent || input.parentElement?.textContent || "");
      if (value && name && !result[value]) result[value] = name;
    }
    return result;
  }, selector);

  const entries = Object.entries(mapping);
  if (entries.length === 0) throw new Error(`Tidak ada checkbox model dengan selector: ${selector}`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  console.log(`Mapping tersimpan: ${outputPath}`);
  console.log(`${entries.length} model terbaca.`);
  console.table(entries.slice(0, 10).map(([value, name]) => ({ value, name })));
} finally {
  await closeSession(session);
}
