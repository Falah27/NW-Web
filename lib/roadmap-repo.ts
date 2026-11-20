import { getDb } from "./db";
import type { Milestone, MilestoneCategory, RoadmapModel } from "./types";
import type {
  CategoryDraftInput,
  CategoryInput,
  MilestoneInput,
} from "./roadmap-validation";

interface ModelRow {
  id: number;
  name: string;
}

interface CategoryRow {
  id: number;
  name: string;
  color: string;
}

interface MilestoneRow {
  id: number;
  model_id: number;
  category_id: number;
  title: string;
  start_date: string;
  end_date: string;
}

function inTransaction<T>(operation: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function requireModel(id: number): void {
  const row = getDb().prepare("SELECT 1 FROM roadmap_models WHERE id = ?").get(id);
  if (!row) throw new Error("Model roadmap tidak ditemukan.");
}

function requireCategory(id: number): void {
  const row = getDb().prepare("SELECT 1 FROM milestone_categories WHERE id = ?").get(id);
  if (!row) throw new Error("Kategori milestone tidak ditemukan.");
}

function ensureModelNameAvailable(name: string, exceptId?: number): void {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM roadmap_models
       WHERE name = ? COLLATE NOCASE AND (? IS NULL OR id != ?)`
    )
    .get(name, exceptId ?? null, exceptId ?? null);
  if (row) throw new Error("Nama model tersebut sudah digunakan.");
}

function ensureCategoryAvailable(input: CategoryInput, exceptId?: number): void {
  const db = getDb();
  const duplicateName = db
    .prepare(
      `SELECT 1 FROM milestone_categories
       WHERE name = ? COLLATE NOCASE AND (? IS NULL OR id != ?)`
    )
    .get(input.name, exceptId ?? null, exceptId ?? null);
  if (duplicateName) throw new Error("Nama kategori tersebut sudah digunakan.");

  const duplicateColor = db
    .prepare(
      `SELECT 1 FROM milestone_categories
       WHERE color = ? COLLATE NOCASE AND (? IS NULL OR id != ?)`
    )
    .get(input.color, exceptId ?? null, exceptId ?? null);
  if (duplicateColor) throw new Error("Warna tersebut sudah digunakan kategori lain.");
}

export function getRoadmapData(): {
  models: RoadmapModel[];
  categories: MilestoneCategory[];
  milestones: Milestone[];
} {
  const db = getDb();
  const models = db
    .prepare("SELECT id, name FROM roadmap_models ORDER BY sort_order, id")
    .all() as unknown as ModelRow[];
  const categories = db
    .prepare("SELECT id, name, color FROM milestone_categories ORDER BY sort_order, id")
    .all() as unknown as CategoryRow[];
  const milestones = db
    .prepare(
      `SELECT id, roadmap_model_id AS model_id, category_id, title, start_date, end_date
       FROM milestones
       ORDER BY start_date, id`
    )
    .all() as unknown as MilestoneRow[];

  return {
    models: models.map((row) => ({ id: row.id, name: row.name })),
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
    })),
    milestones: milestones.map((row) => ({
      id: row.id,
      modelId: row.model_id,
      categoryId: row.category_id,
      title: row.title,
      start: row.start_date,
      end: row.end_date,
    })),
  };
}

export function createMilestone(input: MilestoneInput): number {
  return inTransaction(() => {
    requireModel(input.modelId);
    requireCategory(input.categoryId);
    const result = getDb()
      .prepare(
        `INSERT INTO milestones
           (roadmap_model_id, category_id, title, start_date, end_date)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.modelId, input.categoryId, input.title, input.start, input.end);
    return Number(result.lastInsertRowid);
  });
}

export function updateMilestone(id: number, input: MilestoneInput): void {
  inTransaction(() => {
    requireModel(input.modelId);
    requireCategory(input.categoryId);
    const result = getDb()
      .prepare(
        `UPDATE milestones
         SET roadmap_model_id = ?, category_id = ?, title = ?, start_date = ?, end_date = ?
         WHERE id = ?`
      )
      .run(input.modelId, input.categoryId, input.title, input.start, input.end, id);
    if (Number(result.changes) === 0) throw new Error("Milestone tidak ditemukan.");
  });
}

export function deleteMilestone(id: number): void {
  const result = getDb().prepare("DELETE FROM milestones WHERE id = ?").run(id);
  if (Number(result.changes) === 0) throw new Error("Milestone tidak ditemukan.");
}

export function createModel(name: string): number {
  return inTransaction(() => {
    ensureModelNameAvailable(name);
    const result = getDb()
      .prepare(
        `INSERT INTO roadmap_models (name, model_group_id, sort_order)
         VALUES (
           ?,
           (SELECT id FROM model_groups WHERE name = ? COLLATE NOCASE LIMIT 1),
           COALESCE((SELECT MAX(sort_order) + 1 FROM roadmap_models), 0)
         )`
      )
      .run(name, name);
    return Number(result.lastInsertRowid);
  });
}

export function renameModel(id: number, name: string): void {
  inTransaction(() => {
    requireModel(id);
    ensureModelNameAvailable(name, id);
    getDb()
      .prepare(
        `UPDATE roadmap_models
         SET name = ?, model_group_id = (
           SELECT id FROM model_groups WHERE name = ? COLLATE NOCASE LIMIT 1
         )
         WHERE id = ?`
      )
      .run(name, name, id);
  });
}

export function countMilestonesForModel(modelId: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM milestones WHERE roadmap_model_id = ?")
    .get(modelId) as { count: number };
  return Number(row.count);
}

export function deleteModel(id: number): void {
  const result = getDb().prepare("DELETE FROM roadmap_models WHERE id = ?").run(id);
  if (Number(result.changes) === 0) throw new Error("Model roadmap tidak ditemukan.");
}

export function createCategory(input: CategoryInput): number {
  return inTransaction(() => {
    ensureCategoryAvailable(input);
    const result = getDb()
      .prepare(
        `INSERT INTO milestone_categories (name, color, sort_order)
         VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM milestone_categories), 0))`
      )
      .run(input.name, input.color);
    return Number(result.lastInsertRowid);
  });
}

export function updateCategory(id: number, input: CategoryInput): void {
  inTransaction(() => {
    requireCategory(id);
    ensureCategoryAvailable(input, id);
    getDb()
      .prepare("UPDATE milestone_categories SET name = ?, color = ? WHERE id = ?")
      .run(input.name, input.color, id);
  });
}

export function deleteCategory(id: number): void {
  inTransaction(() => {
    requireCategory(id);
    const count = getDb().prepare("SELECT COUNT(*) AS count FROM milestone_categories").get() as {
      count: number;
    };
    if (Number(count.count) <= 1) throw new Error("Kategori terakhir tidak dapat dihapus.");
    const usage = getDb()
      .prepare("SELECT 1 FROM milestones WHERE category_id = ? LIMIT 1")
      .get(id);
    if (usage) throw new Error("Kategori masih digunakan oleh milestone.");
    getDb().prepare("DELETE FROM milestone_categories WHERE id = ?").run(id);
  });
}

export function saveCategories(categories: CategoryDraftInput[]): void {
  inTransaction(() => {
    const db = getDb();
    const existing = db
      .prepare("SELECT id, name, color FROM milestone_categories")
      .all() as unknown as CategoryRow[];
    const existingById = new Map(existing.map((category) => [category.id, category]));
    const requestedIds = new Set<number>();

    for (const category of categories) {
      if (category.id === undefined) continue;
      if (!existingById.has(category.id)) {
        throw new Error("Kategori milestone tidak ditemukan.");
      }
      if (requestedIds.has(category.id)) throw new Error("Kategori duplikat.");
      requestedIds.add(category.id);
    }

    const removed = existing.filter((category) => !requestedIds.has(category.id));
    for (const category of removed) {
      const usage = db
        .prepare("SELECT 1 FROM milestones WHERE category_id = ? LIMIT 1")
        .get(category.id);
      if (usage) throw new Error(`Kategori "${category.name}" masih digunakan oleh milestone.`);
    }
    for (const category of removed) {
      db.prepare("DELETE FROM milestone_categories WHERE id = ?").run(category.id);
    }

    const retained = categories.filter((category) => category.id !== undefined);
    const usedNames = new Set([
      ...existing.map((category) => category.name.toLocaleLowerCase("id-ID")),
      ...categories.map((category) => category.name.toLocaleLowerCase("id-ID")),
    ]);
    const usedColors = new Set([
      ...existing.map((category) => category.color.toLowerCase()),
      ...categories.map((category) => category.color.toLowerCase()),
    ]);
    let nameSuffix = 0;
    let colorCandidate = 0;

    function temporaryName(id: number): string {
      let candidate: string;
      do {
        candidate = `__roadmap_${id}_${nameSuffix++}`;
      } while (usedNames.has(candidate.toLocaleLowerCase("id-ID")));
      usedNames.add(candidate.toLocaleLowerCase("id-ID"));
      return candidate;
    }

    function temporaryColor(): string {
      while (colorCandidate <= 0xffffff) {
        const candidate = `#${(colorCandidate++).toString(16).padStart(6, "0")}`;
        if (usedColors.has(candidate)) continue;
        usedColors.add(candidate);
        return candidate;
      }
      throw new Error("Tidak tersedia warna sementara untuk menyimpan kategori.");
    }

    for (const category of retained) {
      const id = category.id;
      if (id === undefined) continue;
      db.prepare("UPDATE milestone_categories SET name = ?, color = ? WHERE id = ?")
        .run(temporaryName(id), temporaryColor(), id);
    }

    for (const category of retained) {
      const id = category.id;
      if (id === undefined) continue;
      db.prepare("UPDATE milestone_categories SET name = ?, color = ? WHERE id = ?")
        .run(category.name, category.color, id);
    }

    const maxSortOrder = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS sort_order FROM milestone_categories")
      .get() as { sort_order: number };
    let sortOrder = Number(maxSortOrder.sort_order);
    for (const category of categories) {
      if (category.id !== undefined) continue;
      sortOrder += 1;
      db.prepare(
        "INSERT INTO milestone_categories (name, color, sort_order) VALUES (?, ?, ?)"
      ).run(category.name, category.color, sortOrder);
    }
  });
}
