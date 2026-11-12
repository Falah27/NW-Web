"use server";

import { revalidatePath } from "next/cache";
import { SotApiError } from "@/lib/sot-issues-api";
import { syncSotIssues } from "@/lib/sot-issues-repo";

export type SotIssueSyncResult = { ok: boolean; message?: string; error?: string };

export async function syncSotIssuesAction(): Promise<SotIssueSyncResult> {
  try {
    const { count, pages } = await syncSotIssues();
    revalidatePath("/sot-issues");
    return { ok: true, message: `${count} issue berhasil dibaca dari SOT (${pages} permintaan).` };
  } catch (error) {
    // Hanya SotApiError yang pesannya aman ditampilkan; error lain (database, dll.) tidak dibocorkan mentah.
    if (error instanceof SotApiError) return { ok: false, error: error.message };
    console.error("Sinkron issue SOT gagal:", error);
    return { ok: false, error: "Sinkron issue SOT gagal karena kesalahan di server. Lihat log server." };
  }
}
