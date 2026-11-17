export interface DocumentLink {
  id: number;
  title: string;
  description: string;
  category: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentLinkInput {
  title: string;
  description: string;
  category: string;
  url: string;
  isPrimary: boolean;
}

export function validateDocumentLink(input: Partial<DocumentLinkInput>): DocumentLinkInput | string {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const categoryValue = String(input.category ?? "").trim();
  const url = String(input.url ?? "").trim();
  const isPrimary = Boolean(input.isPrimary);

  if (!title) return "Judul wajib diisi.";
  if (title.length > 120) return "Judul maksimal 120 karakter.";
  if (description.length > 300) return "Deskripsi maksimal 300 karakter.";
  if (categoryValue.length > 40) return "Kategori maksimal 40 karakter.";
  if (!url) return "URL SharePoint wajib diisi.";
  if (url.length > 2048) return "URL maksimal 2048 karakter.";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL SharePoint tidak valid.";
  }
  if (parsed.protocol !== "https:") return "URL harus diawali https://.";

  return {
    title,
    description,
    category: categoryValue || "Lainnya",
    url,
    isPrimary,
  };
}
