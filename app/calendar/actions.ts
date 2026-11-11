"use server";

import { revalidatePath } from "next/cache";
import { createEvent, deleteEvent } from "@/lib/events-repo";
import type { EventKind } from "@/lib/types";
import { toPublicError } from "@/lib/errors";

export type EventFormState = { ok: boolean; error?: string };

const KINDS: EventKind[] = ["meeting", "event", "holiday"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const s = (key: string) => String(formData.get(key) ?? "").trim();
  const title = s("title");
  const kind = s("kind") as EventKind;
  const start = s("start");
  const end = s("end") || null;

  if (!title) return { ok: false, error: "Judul wajib diisi." };
  if (title.length > 120) return { ok: false, error: "Judul maksimal 120 karakter." };
  if (!KINDS.includes(kind)) return { ok: false, error: "Jenis event tidak valid." };
  if (!ISO_DATE.test(start)) return { ok: false, error: "Tanggal mulai wajib diisi." };
  if (end && !ISO_DATE.test(end)) return { ok: false, error: "Format tanggal selesai tidak valid." };
  if (end && end < start) return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };

  try {
    createEvent({ title, kind, start, end });
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal menyimpan event.") };
  }
  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteEventAction(id: string): Promise<EventFormState> {
  if (!id) return { ok: false, error: "ID event tidak valid." };
  try {
    deleteEvent(id);
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal menghapus event.") };
  }
  revalidatePath("/calendar");
  return { ok: true };
}
