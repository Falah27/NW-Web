export type JobStatus = "Closed" | "Running" | "Open" | "Over" | "-";

export interface Job {
  id: string;
  model: string;
  module: string;
  stage: string;
  jobItem: string;
  assignee: string;
  detail?: string;
  remarks?: string;
  sotNo?: string;
  sotUrl?: string; // tautan ke halaman SOT, dibuat otomatis dari sotNo
  sotStatus?: string;
  progress: number; // 0 sampai 1
  startDate: string | null; // format YYYY-MM-DD
  endDate: string | null;
  archived: boolean; // baris yang di-hide di Excel
}

export type EventKind = "meeting" | "event" | "holiday";

export interface TeamEvent {
  id: string;
  title: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD, inklusif
  kind: EventKind;
}

export interface Member {
  id: string;
  name: string; // harus sama persis dengan Job.assignee agar jumlah job terhitung
  role: string;
  skills: string[];
  email?: string;
}