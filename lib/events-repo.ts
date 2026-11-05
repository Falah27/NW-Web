import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { teamEvents as seedEvents } from "./mock-events";
import type { EventKind, TeamEvent } from "./types";

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  kind: EventKind;
}

function ensureTable() {
  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'team_events'").get();
  if (exists) return;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE team_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('meeting', 'event', 'holiday')),
        CHECK (end_date IS NULL OR end_date >= start_date)
      );
      CREATE INDEX team_events_dates_idx ON team_events (start_date, end_date);
    `);
    const insert = db.prepare("INSERT INTO team_events (id, title, start_date, end_date, kind) VALUES (?, ?, ?, ?, ?)");
    for (const event of seedEvents) insert.run(`seed-${event.id}`, event.title, event.start, event.end ?? null, event.kind);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getEvents(): TeamEvent[] {
  ensureTable();
  const rows = getDb().prepare("SELECT id, title, start_date, end_date, kind FROM team_events ORDER BY start_date, id").all() as unknown as EventRow[];
  return rows.map((row) => ({ id: row.id, title: row.title, start: row.start_date, end: row.end_date ?? undefined, kind: row.kind }));
}

export interface EventInput {
  title: string;
  kind: EventKind;
  start: string;
  end: string | null;
}

export function createEvent(input: EventInput): string {
  ensureTable();
  const id = `ev-${randomUUID()}`;
  getDb().prepare("INSERT INTO team_events (id, title, start_date, end_date, kind) VALUES (?, ?, ?, ?, ?)").run(id, input.title, input.start, input.end, input.kind);
  return id;
}

export function deleteEvent(id: string): void {
  ensureTable();
  const result = getDb().prepare("DELETE FROM team_events WHERE id = ?").run(id);
  if (Number(result.changes) === 0) throw new Error("Event tidak ditemukan.");
}
