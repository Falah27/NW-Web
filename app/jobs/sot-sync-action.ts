"use server";

import {
  cancelSotRun,
  getSotState,
  runPrefixAndMapping,
  startSotRun,
  type SotRunKind,
  type SotState,
} from "@/lib/sot-projects-repo";
import { toPublicError } from "@/lib/errors";

export type SotActionResult = { ok: boolean; message?: string; error?: string };

const fail = (error: unknown, fallback: string): SotActionResult => ({ ok: false, error: toPublicError(error, fallback) });

export async function startSotRunAction(kind: SotRunKind, fys: string[] = []): Promise<SotActionResult> {
  if (kind !== "projects" && kind !== "leader" && kind !== "members") return { ok: false, error: "Jenis proses tidak dikenal." };
  if (!Array.isArray(fys) || fys.some((fy) => typeof fy !== "string")) return { ok: false, error: "Pilihan FY tidak valid." };
  try {
    startSotRun(kind, fys);
    return { ok: true };
  } catch (error) {
    return fail(error, "Gagal memulai proses SOT.");
  }
}

export async function cancelSotRunAction(): Promise<SotActionResult> {
  return cancelSotRun() ? { ok: true } : { ok: false, error: "Tidak ada proses yang berjalan." };
}

export async function getSotStateAction(): Promise<SotState> {
  return getSotState();
}

export async function runPrefixAction(): Promise<SotActionResult> {
  try {
    const r = runPrefixAndMapping();
    return {
      ok: true,
      message: `${r.added} prefix baru (total ${r.total}). ${r.matched} model berhasil dicocokkan, ${r.remaining} masih perlu mapping.`,
    };
  } catch (error) {
    return fail(error, "Gagal membangun prefix.");
  }
}
