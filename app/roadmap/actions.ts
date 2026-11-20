"use server";

import { revalidatePath } from "next/cache";
import { assertCanEdit } from "@/lib/auth";
import {
  countMilestonesForModel,
  createCategory,
  createMilestone,
  createModel,
  deleteCategory,
  deleteMilestone,
  deleteModel,
  renameModel,
  saveCategories,
  updateCategory,
  updateMilestone,
} from "@/lib/roadmap-repo";
import {
  validateCategoriesInput,
  validateCategoryInput,
  validateId,
  validateMilestoneInput,
  validateModelName,
} from "@/lib/roadmap-validation";

type ActionResult<T = undefined> =
  | { ok: true; value?: T }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan roadmap.";
}

export async function createMilestoneAction(input: unknown): Promise<ActionResult<number>> {
  try {
    assertCanEdit();
    const validated = validateMilestoneInput(input);
    if (!validated.ok) return validated;
    const id = createMilestone(validated.value);
    revalidatePath("/roadmap");
    return { ok: true, value: id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateMilestoneAction(id: unknown, input: unknown): Promise<ActionResult> {
  try {
    assertCanEdit();
    const validId = validateId(id);
    if (!validId.ok) return validId;
    const validated = validateMilestoneInput(input);
    if (!validated.ok) return validated;
    updateMilestone(validId.value, validated.value);
    revalidatePath("/roadmap");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteMilestoneAction(id: unknown): Promise<ActionResult> {
  try {
    assertCanEdit();
    const validId = validateId(id);
    if (!validId.ok) return validId;
    deleteMilestone(validId.value);
    revalidatePath("/roadmap");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function createModelAction(name: unknown): Promise<ActionResult<number>> {
  try {
    assertCanEdit();
    const validated = validateModelName(name);
    if (!validated.ok) return validated;
    const id = createModel(validated.value);
    revalidatePath("/roadmap");
    return { ok: true, value: id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function renameModelAction(id: unknown, name: unknown): Promise<ActionResult> {
  try {
    assertCanEdit();
    const validId = validateId(id);
    if (!validId.ok) return validId;
    const validated = validateModelName(name);
    if (!validated.ok) return validated;
    renameModel(validId.value, validated.value);
    revalidatePath("/roadmap");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteModelAction(
  id: unknown
): Promise<ActionResult<{ deletedMilestones: number }>> {
  try {
    assertCanEdit();
    const validId = validateId(id);
    if (!validId.ok) return validId;
    const deletedMilestones = countMilestonesForModel(validId.value);
    deleteModel(validId.value);
    revalidatePath("/roadmap");
    return { ok: true, value: { deletedMilestones } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function createCategoryAction(
  name: unknown,
  color: unknown
): Promise<ActionResult<number>> {
  try {
    assertCanEdit();
    const validated = validateCategoryInput({ name, color });
    if (!validated.ok) return validated;
    const id = createCategory(validated.value);
    revalidatePath("/roadmap");
    return { ok: true, value: id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateCategoryAction(
  id: unknown,
  name: unknown,
  color: unknown
): Promise<ActionResult> {
  try {
    assertCanEdit();
    const validId = validateId(id);
    if (!validId.ok) return validId;
    const validated = validateCategoryInput({ name, color });
    if (!validated.ok) return validated;
    updateCategory(validId.value, validated.value);
    revalidatePath("/roadmap");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteCategoryAction(id: unknown): Promise<ActionResult> {
  try {
    assertCanEdit();
    const validId = validateId(id);
    if (!validId.ok) return validId;
    deleteCategory(validId.value);
    revalidatePath("/roadmap");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function saveCategoriesAction(input: unknown): Promise<ActionResult> {
  try {
    assertCanEdit();
    const validated = validateCategoriesInput(input);
    if (!validated.ok) return validated;
    saveCategories(validated.value);
    revalidatePath("/roadmap");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
