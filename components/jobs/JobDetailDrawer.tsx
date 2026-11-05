"use client";

import { useEffect } from "react";
import type { Job, JobStatus } from "@/lib/types";
import { todayISO } from "@/lib/status";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";

type JobWithStatus = Job & { status: JobStatus };

const DAY_MS = 86_400_000;

function diffDays(from: string, to: string): number {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  return Math.round((b - a) / DAY_MS);
}

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function timeInfo(job: JobWithStatus): string {
  if (!job.startDate || !job.endDate) return "Jadwal belum lengkap";
  const today = todayISO();
  if (job.status === "Closed") return "Selesai";
  if (job.status === "Open") return `Mulai dalam ${diffDays(today, job.startDate)} hari`;
  const left = diffDays(today, job.endDate);
  if (left >= 0) return left === 0 ? "Berakhir hari ini" : `${left} hari lagi`;
  return `Terlambat ${Math.abs(left)} hari`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </>
  );
}

export default function JobDetailDrawer({
  job,
  onClose,
  onEdit,
  onDelete,
  deleting,
}: {
  job: JobWithStatus | null;
  onClose: () => void;
  onEdit: (job: JobWithStatus) => void;
  onDelete: (job: JobWithStatus) => void;
  deleting: boolean;
}) {
  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  if (!job) return null;

  const duration =
    job.startDate && job.endDate ? diffDays(job.startDate, job.endDate) + 1 : null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detail job ${job.jobItem}`}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500">{job.model}</div>
            <h2 className="mt-1 text-xl font-bold leading-snug">{job.jobItem}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
          <span className="text-sm text-slate-600">{timeInfo(job)}</span>
        </div>

        <ProgressBar value={job.progress} />

        <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2.5 text-sm">
          <Row label="Modul">{job.module}</Row>
          <Row label="Stage">{job.stage}</Row>
          <Row label="PIC">{job.assignee}</Row>
          <Row label="Mulai">{fmt(job.startDate)}</Row>
          <Row label="Selesai">{fmt(job.endDate)}</Row>
          <Row label="Durasi">{duration ? `${duration} hari` : "-"}</Row>
          {job.sotNo && <Row label="SOT No">{job.sotNo}</Row>}
          {job.sotStatus && <Row label="SOT Status">{job.sotStatus}</Row>}
        </dl>

        <section>
          <h3 className="mb-1.5 text-sm font-bold">Detail job</h3>
          <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {job.detail || "Belum ada detail."}
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-sm font-bold">Remarks</h3>
          <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {job.remarks || "Tidak ada remarks."}
          </p>
          </section>
                  <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => onEdit(job)}
              className="h-10 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(job)}
              disabled={deleting}
              className="h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </button>
          </div>
      </aside>
    </div>
  );
}