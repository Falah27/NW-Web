import type { Job, JobStatus } from "./types";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeStatus(job: Job, today: string = todayISO()): JobStatus {
  if (!job.jobItem || !job.assignee || !job.startDate || !job.endDate) return "-";
  if (job.progress >= 1) return "Closed";
  if (job.startDate > today) return "Open";
  return job.endDate >= today ? "Running" : "Over";
}