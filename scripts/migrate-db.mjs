import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { applySchema } from "./schema.mjs";
import { runMigrations } from "../lib/migrations.ts";

export function seedRoadmap(db) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM roadmap_models").get();
  if (Number(count.count) > 0) return;

  const referencePath = path.join(process.cwd(), "docs", "reference", "roadmap_models 1.html");
  if (!fs.existsSync(referencePath)) {
    throw new Error(`File referensi roadmap tidak ditemukan: ${referencePath}`);
  }
  const html = fs.readFileSync(referencePath, "utf8");

  const extractArray = (name) => {
    const match = new RegExp(`const ${name}=((?:\\[[\\s\\S]*?\\]));`, "m").exec(html);
    if (!match) throw new Error(`Konstanta ${name} tidak ditemukan pada referensi roadmap.`);
    return Function(`"use strict"; return (${match[1].trim()});`)();
  };

  const modelNames = extractArray("defaultModelNames");
  const categories = extractArray("defaultCategories");
  const events = extractArray("defaultEvents");

  if (!Array.isArray(modelNames) || modelNames.length !== 33) {
    throw new Error(`Seed model roadmap tidak valid: diharapkan 33, diperoleh ${modelNames.length}.`);
  }
  if (!Array.isArray(categories) || categories.length !== 7) {
    throw new Error(`Seed kategori roadmap tidak valid: diharapkan 7, diperoleh ${categories.length}.`);
  }
  if (!Array.isArray(events) || events.length !== 11) {
    throw new Error(`Seed milestone roadmap tidak valid: diharapkan 11, diperoleh ${events.length}.`);
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const insertModel = db.prepare(
      "INSERT OR IGNORE INTO roadmap_models (name, sort_order) VALUES (?, ?)"
    );
    modelNames.forEach((name, index) => insertModel.run(name, index));

    const insertCategory = db.prepare(
      "INSERT OR IGNORE INTO milestone_categories (name, color, sort_order) VALUES (?, ?, ?)"
    );
    categories.forEach((category, index) =>
      insertCategory.run(category.name, category.color, index)
    );

    const findModel = db.prepare("SELECT id FROM roadmap_models WHERE name = ? COLLATE NOCASE");
    const findCategory = db.prepare("SELECT id FROM milestone_categories WHERE name = ?");
    const insertMilestone = db.prepare(`
      INSERT INTO milestones
        (roadmap_model_id, category_id, title, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const event of events) {
      const model = findModel.get(event.model);
      const categoryData = categories.find((category) => category.id === event.color);
      if (!model || !categoryData) continue;
      const category = findCategory.get(categoryData.name);
      if (!category) continue;
      insertMilestone.run(model.id, category.id, event.title, event.start, event.end);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "dev.db");

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`Database tidak ditemukan: ${databasePath}. Jalankan npm run db:init -- --force.`);
  }
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  applySchema(db);
  runMigrations(db);
  seedRoadmap(db);
  db.close();
  console.log(`Migrasi roadmap selesai di ${databasePath}.`);
}
