"use server";

import { revalidatePath } from "next/cache";
import { clearSotData, saveSotManualMapping } from "@/lib/sot-job-repo";

export type SotMappingActionResult = { ok: boolean; error?: string };

export type SotResetActionResult = { ok: boolean; error?: string };

export async function clearSotDataAction(): Promise<SotResetActionResult> {
  try {
    clearSotData();
    revalidatePath("/sot-job");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menghapus data SOT." };
  }
}

export async function saveSotManualMappingAction(
  projectId: number,
  sourceName: string,
  modelGroupId: number | null
): Promise<SotMappingActionResult> {
  if (!Number.isInteger(projectId) || projectId <= 0) return { ok: false, error: "Project tidak valid." };
  if (!sourceName.trim() || sourceName.length > 200) return { ok: false, error: "Target model tidak valid." };
  if (modelGroupId !== null && (!Number.isInteger(modelGroupId) || modelGroupId <= 0)) {
    return { ok: false, error: "Model group tidak valid." };
  }

  try {
    saveSotManualMapping(projectId, sourceName, modelGroupId);
    revalidatePath("/sot-job");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan mapping." };
  }
}
