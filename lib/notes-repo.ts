import { getDb } from "./db";
import type { JobNote } from "./types";

interface NoteRow {
  id: number;
  job_id: string;
  content: string;
  created_at: string;
}

export function getNotesMap(): Map<string, JobNote[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, job_id, content,
              strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at
       FROM job_notes
       ORDER BY id DESC`
    )
    .all() as unknown as NoteRow[];

  const map = new Map<string, JobNote[]>();
  for (const r of rows) {
    const list = map.get(r.job_id) ?? [];
    list.push({ id: r.id, content: r.content, createdAt: r.created_at });
    map.set(r.job_id, list);
  }
  return map;
}

export function addNote(jobId: string, content: string): boolean {
  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM jobs WHERE id = ?").get(jobId);
  if (!exists) return false;
  db.prepare("INSERT INTO job_notes (job_id, content) VALUES (?, ?)").run(jobId, content);
  return true;
}

export function deleteNote(id: number): void {
  getDb().prepare("DELETE FROM job_notes WHERE id = ?").run(id);
}