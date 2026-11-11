"use server";

import { revalidatePath } from "next/cache";
import { importWorkbook } from "@/lib/xlsm-import";
import { toPublicError } from "@/lib/errors";

export type SyncState = { ok: boolean; message?: string; error?: string };

const MAX_BYTES = Number.parseInt(process.env.IMPORT_MAX_BYTES ?? "", 10) || 10 * 1024 * 1024;

export async function syncExcelAction(_prev: SyncState, formData: FormData): Promise<SyncState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih file Excel (.xlsm atau .xlsx) terlebih dahulu." };
  }
  if (!/\.(xlsm|xlsx)$/i.test(file.name)) {
    return { ok: false, error: "Format file harus .xlsm atau .xlsx." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `Ukuran file maksimal ${Math.floor(MAX_BYTES / (1024 * 1024))} MB.` };
  }
  const sheetName = String(formData.get("sheet") ?? "").trim() || "Job_Follow_Up";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 4 || buffer.subarray(0, 4).compare(Buffer.from([0x50, 0x4b, 0x03, 0x04])) !== 0) {
      return { ok: false, error: "File bukan workbook XLSX/XLSM yang valid (ZIP signature tidak ditemukan)." };
    }
    const { count, archived, added, updated, deleted, skippedLocal } = importWorkbook(buffer, file.name, sheetName);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${count} job diproses dari ${file.name}: ${added} ditambah, ${updated} diperbarui, ${deleted} dihapus, ${skippedLocal} dilewati karena diedit lokal (${archived} diarsipkan).`,
    };
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal mengimpor file.") };
  }
}
