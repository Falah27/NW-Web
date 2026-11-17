"use server";

import { revalidatePath } from "next/cache";
import { createDocumentLink, deleteDocumentLink, updateDocumentLink } from "@/lib/documents-repo";
import { validateDocumentLink, type DocumentLinkInput } from "@/lib/document-link";
import { toPublicError } from "@/lib/errors";

export type DocumentFormState = { ok: boolean; error?: string };

function parseForm(formData: FormData): DocumentLinkInput | string {
  const value = (key: string) => String(formData.get(key) ?? "");
  return validateDocumentLink({
    title: value("title"),
    description: value("description"),
    category: value("category"),
    url: value("url"),
    isPrimary: formData.get("isPrimary") === "on",
  });
}

export async function saveDocumentLinkAction(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const input = parseForm(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const rawId = String(formData.get("id") ?? "").trim();
  const id = rawId ? Number(rawId) : null;
  if (rawId && (!Number.isInteger(id) || id === null || id < 1)) return { ok: false, error: "ID pintasan tidak valid." };

  try {
    if (id === null) createDocumentLink(input);
    else updateDocumentLink(id, input);
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal menyimpan pintasan dokumen.") };
  }

  revalidatePath("/documents");
  return { ok: true };
}

export async function deleteDocumentLinkAction(id: number): Promise<DocumentFormState> {
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "ID pintasan tidak valid." };
  try {
    deleteDocumentLink(id);
  } catch (error) {
    return { ok: false, error: toPublicError(error, "Gagal menghapus pintasan dokumen.") };
  }
  revalidatePath("/documents");
  return { ok: true };
}
