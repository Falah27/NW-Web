"use server";

import { revalidatePath } from "next/cache";
import { createJob, deleteJob, updateJob, type JobInput } from "@/lib/jobs-repo";
import { SOT_ERROR, isValidSotNo } from "@/lib/sot";
import { toPublicError } from "@/lib/errors";

export type FormState = { ok: boolean; error?: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseForm(formData: FormData): JobInput | string {
  const s = (key: string) => String(formData.get(key) ?? "").trim();

  const model = s("model");
  const moduleName = s("module");
  const stage = s("stage");
  const jobItem = s("jobItem");
  const assignee = s("assignee");
  const detail = s("detail");
  const remarks = s("remarks");
  if (model.length > 200 || moduleName.length > 200 || stage.length > 200 || assignee.length > 200) {
    return "Model, module, stage, dan PIC maksimal 200 karakter.";
  }
  if (jobItem.length > 500) return "Job item maksimal 500 karakter.";
  if (detail.length > 5000 || remarks.length > 5000) return "Detail dan remarks maksimal 5000 karakter.";
  if (!model || !jobItem || !assignee) {
    return "Model, Job item, dan PIC wajib diisi.";
  }

  const sotNo = s("sotNo");
  if (sotNo && !isValidSotNo(sotNo)) return SOT_ERROR;

  const progressPct = Number(s("progress") || "0");
  if (!Number.isFinite(progressPct) || progressPct < 0 || progressPct > 100) {
    return "Progress harus berupa angka 0 sampai 100.";
  }

  const startDate = s("startDate") || null;
  const endDate = s("endDate") || null;
  if ((startDate && !ISO_DATE.test(startDate)) || (endDate && !ISO_DATE.test(endDate))) {
    return "Format tanggal tidak valid.";
  }
  if (startDate && endDate && endDate < startDate) {
    return "End Date tidak boleh lebih awal dari Start Date.";
  }

  return {
    model,
    module: moduleName,
    stage,
    jobItem,
    assignee,
    detail,
    remarks,
    sotNo,
    sotStatus: s("sotStatus"),
    progress: progressPct / 100,
    startDate,
    endDate,
  };
}

export async function saveJobAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = parseForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const id = String(formData.get("id") ?? "").trim();
  try {
    if (id) updateJob(id, input);
    else createJob(input);
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal menyimpan job.") };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteJobAction(id: string): Promise<FormState> {
  if (!id) return { ok: false, error: "ID job tidak valid." };
  try {
    deleteJob(id);
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal menghapus job.") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}