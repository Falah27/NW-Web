import type { TeamEvent } from "./types";

export const teamEvents: TeamEvent[] = [
  { id: "e1", title: "Rapat mingguan team", start: "2026-11-09", kind: "meeting" },
  { id: "e2", title: "Rapat mingguan team", start: "2026-11-16", kind: "meeting" },
  { id: "e3", title: "Rapat mingguan team", start: "2026-11-23", kind: "meeting" },
  { id: "e4", title: "Rapat mingguan team", start: "2026-11-30", kind: "meeting" },
  { id: "e5", title: "Review SDR1", start: "2026-11-12", kind: "event" },
  { id: "e6", title: "Training internal", start: "2026-11-18", end: "2026-11-19", kind: "event" },
  { id: "e7", title: "Libur", start: "2026-12-25", kind: "holiday" },
];