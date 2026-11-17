import { getDb } from "./db";
import type { DocumentLink, DocumentLinkInput } from "./document-link";

interface DocumentLinkRow {
  id: number;
  title: string;
  description: string;
  category: string;
  url: string;
  is_primary: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DocumentLinkRow): DocumentLink {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    url: row.url,
    isPrimary: row.is_primary === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function clearPrimary() {
  getDb().prepare("UPDATE document_links SET is_primary = 0, updated_at = datetime('now') WHERE is_primary = 1").run();
}

export function getDocumentLinks(): DocumentLink[] {
  const rows = getDb().prepare(`
    SELECT id, title, description, category, url, is_primary, sort_order, created_at, updated_at
    FROM document_links
    ORDER BY is_primary DESC, category COLLATE NOCASE, sort_order, title COLLATE NOCASE, id
  `).all() as unknown as DocumentLinkRow[];
  return rows.map(mapRow);
}

export function createDocumentLink(input: DocumentLinkInput): number {
  return transaction(() => {
    if (input.isPrimary) clearPrimary();
    const result = getDb().prepare(`
      INSERT INTO document_links (title, description, category, url, is_primary, sort_order)
      VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM document_links))
    `).run(input.title, input.description, input.category, input.url, input.isPrimary ? 1 : 0);
    return Number(result.lastInsertRowid);
  });
}

export function updateDocumentLink(id: number, input: DocumentLinkInput): void {
  transaction(() => {
    if (input.isPrimary) clearPrimary();
    const result = getDb().prepare(`
      UPDATE document_links
      SET title = ?, description = ?, category = ?, url = ?, is_primary = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(input.title, input.description, input.category, input.url, input.isPrimary ? 1 : 0, id);
    if (Number(result.changes) === 0) throw new Error("Pintasan dokumen tidak ditemukan.");
  });
}

export function deleteDocumentLink(id: number): void {
  const result = getDb().prepare("DELETE FROM document_links WHERE id = ?").run(id);
  if (Number(result.changes) === 0) throw new Error("Pintasan dokumen tidak ditemukan.");
}
