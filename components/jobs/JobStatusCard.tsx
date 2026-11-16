"use client";

import type { Job, JobStatus } from "@/lib/types";
import { diffDaysISO } from "@/lib/date";

export type JobWithStatus = Job & { status: JobStatus };

export const statusTheme: Record<JobStatus, { label: string; strip: string; dot: string; soft: string; text: string; bar: string }> = {
  Running: { label: "Sedang berjalan", strip: "bg-blue-600", dot: "bg-blue-600", soft: "bg-blue-50", text: "text-blue-900", bar: "bg-blue-600" },
  Open: { label: "Belum mulai", strip: "bg-slate-400", dot: "bg-slate-500", soft: "bg-slate-100", text: "text-slate-800", bar: "bg-slate-500" },
  Over: { label: "Lewat deadline", strip: "bg-red-600", dot: "bg-red-600", soft: "bg-red-50", text: "text-red-900", bar: "bg-red-600" },
  Closed: { label: "Selesai", strip: "bg-emerald-600", dot: "bg-emerald-600", soft: "bg-emerald-50", text: "text-emerald-900", bar: "bg-emerald-600" },
  "-": { label: "Jadwal belum lengkap", strip: "bg-slate-300", dot: "bg-slate-400", soft: "bg-slate-100", text: "text-slate-700", bar: "bg-slate-400" },
};

function timeHint(job: JobWithStatus, today: string): string {
  if (!job.startDate || !job.endDate) return "Isi Start Date dan End Date di Excel";
  if (job.status === "Closed") return "Semua pekerjaan sudah selesai";
  if (job.status === "Open") {
    const n = diffDaysISO(today, job.startDate);
    return n === 1 ? "Mulai besok" : `Mulai ${n} hari lagi`;
  }
  const left = diffDaysISO(today, job.endDate);
  if (left > 0) return `Sisa ${left} hari sampai deadline`;
  if (left === 0) return "Deadline hari ini";
  return `Terlambat ${Math.abs(left)} hari`;
}

export default function JobStatusCard({ job, today }: { job: JobWithStatus; today: string }) {
  const theme = statusTheme[job.status];
  const pct = Math.round(job.progress * 100);

  return (
    <section className={`rounded-2xl p-4 ${theme.soft}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`flex items-center gap-2 text-sm font-bold ${theme.text}`}><i className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />{theme.label}</span>
        <span className={`text-sm font-medium ${theme.text}`}>{timeHint(job, today)}</span>
      </div>
      <div className="mt-4 flex items-end justify-between"><span className="text-sm text-slate-600">Progress</span><span className={`text-3xl font-bold leading-none tracking-tight ${theme.text}`}>{pct}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${pct}%` }} /></div>
    </section>
  );
}
