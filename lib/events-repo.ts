import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { EventKind, TeamEvent } from "./types";

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  kind: EventKind;
}

export function getEvents(): TeamEvent[] {
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
  const id = `ev-${randomUUID()}`;
  getDb().prepare("INSERT INTO team_events (id, title, start_date, end_date, kind) VALUES (?, ?, ?, ?, ?)").run(id, input.title, input.start, input.end, input.kind);
  return id;
}

export function deleteEvent(id: string): void {
  const result = getDb().prepare("DELETE FROM team_events WHERE id = ?").run(id);
  if (Number(result.changes) === 0) throw new Error("Event tidak ditemukan.");
}
