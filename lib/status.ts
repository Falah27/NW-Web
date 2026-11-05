import type { Job, JobStatus } from "./types";

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function computeStatus(job: Job, today: string = todayISO()): JobStatus {
  if (!job.jobItem || !job.assignee || !job.startDate || !job.endDate) return "-";
  if (job.progress >= 1) return "Closed";
  if (job.startDate > today) return "Open";
  return job.endDate >= today ? "Running" : "Over";
}