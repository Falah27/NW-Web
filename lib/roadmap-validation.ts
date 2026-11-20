import { diffDaysISO, isValidISODate } from "./dates.ts";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface MilestoneInput {
  modelId: number;
  categoryId: number;
  title: string;
  start: string;
  end: string;
}

export interface CategoryInput {
  name: string;
  color: string;
}

export interface CategoryDraftInput extends CategoryInput {
  id?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateId(value: unknown): ValidationResult<number> {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    return { ok: false, error: "ID harus berupa bilangan bulat positif." };
  }
  return { ok: true, value };
}

export function validateModelName(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") return { ok: false, error: "Nama model harus berupa teks." };
  const name = value.trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "Nama model wajib diisi dan maksimal 80 karakter." };
  }
  return { ok: true, value: name };
}

export function validateCategoryName(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") return { ok: false, error: "Nama kategori harus berupa teks." };
  const name = value.trim();
  if (!name || name.length > 40) {
    return { ok: false, error: "Nama kategori wajib diisi dan maksimal 40 karakter." };
  }
  return { ok: true, value: name };
}

export function validateCategoryInput(value: unknown): ValidationResult<CategoryInput> {
  if (!isRecord(value)) return { ok: false, error: "Data kategori tidak valid." };
  const name = validateCategoryName(value.name);
  if (!name.ok) return name;
  if (typeof value.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.color)) {
    return { ok: false, error: "Warna harus berupa kode heksadesimal, contoh #0875d1." };
  }
  return { ok: true, value: { name: name.value, color: value.color } };
}

export function validateCategoriesInput(value: unknown): ValidationResult<CategoryDraftInput[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Minimal satu kategori harus tersedia." };
  }

  const categories: CategoryDraftInput[] = [];
  const ids = new Set<number>();
  const names = new Set<string>();
  const colors = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "Data kategori tidak valid." };
    const category = validateCategoryInput(item);
    if (!category.ok) return category;

    let id: number | undefined;
    if (item.id !== undefined) {
      const validatedId = validateId(item.id);
      if (!validatedId.ok) return validatedId;
      id = validatedId.value;
      if (ids.has(id)) return { ok: false, error: "Kategori duplikat." };
      ids.add(id);
    }

    const normalizedName = category.value.name.toLocaleLowerCase("id-ID");
    if (names.has(normalizedName)) {
      return { ok: false, error: "Nama kategori tidak boleh kembar." };
    }
    names.add(normalizedName);

    const normalizedColor = category.value.color.toLowerCase();
    if (colors.has(normalizedColor)) {
      return { ok: false, error: "Warna kategori tidak boleh kembar." };
    }
    colors.add(normalizedColor);
    categories.push({ ...category.value, ...(id === undefined ? {} : { id }) });
  }

  return { ok: true, value: categories };
}

export function validateMilestoneInput(value: unknown): ValidationResult<MilestoneInput> {
  if (!isRecord(value)) return { ok: false, error: "Data milestone tidak valid." };
  const modelId = validateId(value.modelId);
  if (!modelId.ok) return { ok: false, error: "Model tidak valid." };
  const categoryId = validateId(value.categoryId);
  if (!categoryId.ok) return { ok: false, error: "Kategori tidak valid." };
  if (typeof value.title !== "string") return { ok: false, error: "Nama milestone harus berupa teks." };
  const title = value.title.trim();
  if (!title || title.length > 120) {
    return { ok: false, error: "Nama milestone wajib diisi dan maksimal 120 karakter." };
  }
  if (!isValidISODate(value.start) || !isValidISODate(value.end)) {
    return { ok: false, error: "Tanggal milestone tidak valid." };
  }
  if (value.end < value.start) {
    return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  }
  if (diffDaysISO(value.start, value.end) + 1 > 1096) {
    return { ok: false, error: "Durasi milestone maksimal 1096 hari." };
  }
  return {
    ok: true,
    value: {
      modelId: modelId.value,
      categoryId: categoryId.value,
      title,
      start: value.start,
      end: value.end,
    },
  };
}
