"use server";

import { revalidatePath } from "next/cache";
import { syncSotProjects } from "@/lib/sot-projects-repo";

export type SotSyncState = { ok: boolean; message?: string; error?: string };

export async function syncSotAction(): Promise<SotSyncState> {
  try {
    const result = await syncSotProjects();
    revalidatePath("/", "layout");
    const unmatched = result.unmatchedMembers.length;
    return {
      ok: true,
      message: `${result.projectCount} project dan ${result.memberCount} target model berhasil disinkronkan.${result.prefixMappedMembers ? ` ${result.prefixMappedMembers} model dipetakan lewat prefix.` : ""}${unmatched ? ` ${unmatched} model perlu mapping.` : ""}`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal sinkronisasi SOT." };
  }
}
