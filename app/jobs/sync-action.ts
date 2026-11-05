"use server";

import { revalidatePath } from "next/cache";
import { importWorkbook } from "@/lib/xlsm-import";

export type SyncState = { ok: boolean; message?: string; error?: string };

const MAX_BYTES = 25 * 1024 * 1024;

export async function syncExcelAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih file Excel (.xlsm atau .xlsx) terlebih dahulu." };
  }
  if (!/\.(xlsm|xlsx)$/i.test(file.name)) {
    return { ok: false, error: "Format file harus .xlsm atau .xlsx." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Ukuran file maksimal 25 MB." };
  }
  const sheetName = String(formData.get("sheet") ?? "").trim() || "Job_Follow_Up";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { count, archived } = importWorkbook(buffer, file.name, sheetName);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${count} job berhasil diimpor dari ${file.name} (${archived} diarsipkan).`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengimpor file." };
  }
}
