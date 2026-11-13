"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Job, JobStatus } from "@/lib/types";
import { diffDaysISO } from "@/lib/date";
import useDialogFocus from "@/components/ui/useDialogFocus";

type JobWithStatus = Job & { status: JobStatus };

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

function fmt(iso: string | null, short = false) {
  if (!iso) return "-";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: short ? "short" : "long",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

const theme: Record<
  JobStatus,
  { label: string; strip: string; dot: string; soft: string; text: string; bar: string }
> = {
  Running: {
    label: "Sedang berjalan",
    strip: "bg-blue-600",
    dot: "bg-blue-600",
    soft: "bg-blue-50",
    text: "text-blue-900",
    bar: "bg-blue-600",
  },
  Open: {
    label: "Belum mulai",
    strip: "bg-slate-400",
    dot: "bg-slate-500",
    soft: "bg-slate-100",
    text: "text-slate-800",
    bar: "bg-slate-500",
  },
  Over: {
    label: "Lewat deadline",
    strip: "bg-red-600",
    dot: "bg-red-600",
    soft: "bg-red-50",
    text: "text-red-900",
    bar: "bg-red-600",
  },
  Closed: {
    label: "Selesai",
    strip: "bg-emerald-600",
    dot: "bg-emerald-600",
    soft: "bg-emerald-50",
    text: "text-emerald-900",
    bar: "bg-emerald-600",
  },
  "-": {
    label: "Jadwal belum lengkap",
    strip: "bg-slate-300",
    dot: "bg-slate-400",
    soft: "bg-slate-100",
    text: "text-slate-700",
    bar: "bg-slate-400",
  },
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

type StepState = "done" | "current" | "late" | "todo";

function StepDot({ state }: { state: StepState }) {
  const base = "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold";
  if (state === "done") return <span className={`${base} bg-emerald-600 text-white`}>✓</span>;
  if (state === "current") {
    return (
      <span className={`${base} border-2 border-blue-600 bg-white`}>
        <i className="h-2 w-2 rounded-full bg-blue-600" />
      </span>
    );
  }
  if (state === "late") return <span className={`${base} bg-red-600 text-white`}>!</span>;
  return <span className={`${base} border-2 border-slate-300 bg-white`} />;
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Footer({
  job,
  onClose,
  onEdit,
  onDelete,
}: {
  job: Job;
  onClose: () => void;
  onEdit?: (job: Job) => void;
  onDelete?: (job: Job) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!onEdit && !onDelete) {
    return (
      <footer className="flex flex-none gap-2 border-t border-slate-200 bg-white px-6 py-4">
        <Link href="/jobs" className="flex h-10 flex-1 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white transition hover:opacity-90">
          Ubah di Monitoring Job
        </Link>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold transition hover:bg-slate-50">
          Tutup
        </button>
      </footer>
    );
  }

  if (confirming) {
    return (
      <footer className="flex flex-none flex-col gap-3 border-t border-red-200 bg-red-50 px-6 py-4">
        <p className="text-sm text-red-900">Hapus <b>{job.jobItem}</b>? Job yang dihapus tidak bisa dikembalikan.</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete?.(job);
              } finally {
                setBusy(false);
              }
            }}
            className="h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "Menghapus..." : "Ya, hapus job"}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold transition hover:bg-slate-50">
            Batal
          </button>
        </div>
      </footer>
    );
  }

  return (
    <footer className="flex flex-none gap-2 border-t border-slate-200 bg-white px-6 py-4">
      {onEdit && <button type="button" onClick={() => onEdit(job)} className="h-10 flex-1 rounded-lg bg-brand text-sm font-semibold text-white transition hover:opacity-90">Edit job</button>}
      {onDelete && <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50">Hapus</button>}
    </footer>
  );
}

export default function JobDetailDrawer({
  job,
  onClose,
  onEdit,
  onDelete,
  today,
}: {
  job: JobWithStatus | null;
  onClose: () => void;
  onEdit?: (job: Job) => void;
  onDelete?: (job: Job) => void | Promise<void>;
  today: string;
}) {
  const dialogRef = useDialogFocus<HTMLElement>({ open: Boolean(job), onClose });

  if (!job || typeof document === "undefined") return null;

  const t = theme[job.status];
  const pct = Math.round(job.progress * 100);
  const hasDates = !!job.startDate && !!job.endDate;
  const totalDays = hasDates ? diffDaysISO(job.startDate!, job.endDate!) + 1 : null;
  const elapsedPct = hasDates
    ? clamp((diffDaysISO(job.startDate!, today) / Math.max(1, totalDays! - 1)) * 100)
    : 0;
  const showToday = hasDates && (job.status === "Running" || job.status === "Over");

  const steps: { title: string; note: string; state: StepState }[] = hasDates
    ? [
        {
          title: "Mulai dikerjakan",
          note: fmt(job.startDate),
          state: today >= job.startDate! ? "done" : "todo",
        },
        {
          title: "Progress pekerjaan",
          note: `${pct}% selesai`,
          state: job.status === "Closed" ? "done" : job.status === "Open" ? "todo" : "current",
        },
        {
          title: "Deadline",
          note: fmt(job.endDate),
          state: job.status === "Closed" ? "done" : job.status === "Over" ? "late" : "todo",
        },
      ]
    : [];

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="drawer-overlay-in absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detail job ${job.jobItem}`}
        className="drawer-in absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-white shadow-2xl sm:right-3 sm:top-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl"
      >
        <div className={`h-1.5 flex-none ${t.strip}`} />
        <div className="flex-1 overflow-y-auto">
          <header className="flex items-start justify-between gap-4 px-6 pb-5 pt-5">
            <div className="min-w-0">
              <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {job.model}
              </span>
              <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900">{job.jobItem}</h2>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                  {initials(job.assignee)}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-slate-900">{job.assignee || "-"}</div>
                  <div className="text-xs text-slate-500">Penanggung jawab</div>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup detail" className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-slate-200 text-lg text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand">
              ×
            </button>
          </header>

          <div className="flex flex-col gap-6 px-6 pb-6">
            <section className={`rounded-2xl p-4 ${t.soft}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-2 text-sm font-bold ${t.text}`}>
                  <i className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
                  {t.label}
                </span>
                <span className={`text-sm font-medium ${t.text}`}>{timeHint(job, today)}</span>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-sm text-slate-600">Progress</span>
                <span className={`text-3xl font-bold leading-none tracking-tight ${t.text}`}>{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900">Jadwal</h3>
              {hasDates ? (
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <div><div className="text-xs text-slate-500">Mulai</div><div className="font-semibold">{fmt(job.startDate, true)}</div></div>
                    <div className="text-right"><div className="text-xs text-slate-500">Selesai</div><div className="font-semibold">{fmt(job.endDate, true)}</div></div>
                  </div>
                  <div className="relative mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-slate-400" style={{ width: `${job.status === "Closed" ? 100 : elapsedPct}%` }} />
                    {showToday && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow" style={{ left: `${elapsedPct}%` }} title="Hari ini" />}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Durasi {totalDays} hari{showToday && ", titik hitam menandai hari ini"}</p>
                </div>
              ) : <p className="mt-2 text-sm text-slate-500">Tanggal belum lengkap.</p>}
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900">Informasi</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-slate-200 p-4">
                <Field label="Modul" value={job.module} />
                <Field label="Stage" value={job.stage} />
                {job.sotNo && (
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">SOT No</dt>
                    <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {job.sotNo}
                      {job.sotUrl && (
                        <a
                          href={job.sotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Hanya bisa dibuka saat terhubung ke LAN/VPN kantor"
                          className="inline-flex h-7 items-center rounded-md border border-brand px-2 text-xs font-semibold text-brand hover:bg-brand-soft"
                        >
                          Buka SOT ↗
                        </a>
                      )}
                    </dd>
                  </div>
                )}
                <Field label="SOT Status" value={job.sotStatus} />
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-bold text-slate-900">Detail pekerjaan</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{job.detail || <span className="text-slate-400">Belum ada detail.</span>}</p>
            </section>

            {job.remarks && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-bold text-amber-900">Catatan</h3><p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-amber-900/90">{job.remarks}</p></section>}

            {steps.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-slate-900">Perjalanan job</h3>
                <ol className="mt-3">
                  {steps.map((step, index) => (
                    <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < steps.length - 1 && <span className="absolute left-3 top-6 h-[calc(100%-1.5rem)] w-px -translate-x-1/2 bg-slate-200" />}
                      <StepDot state={step.state} />
                      <div className="leading-tight"><div className={`text-sm font-semibold ${step.state === "late" ? "text-red-700" : "text-slate-900"}`}>{step.title}</div><div className="mt-1 text-xs text-slate-500">{step.note}</div></div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>

        <Footer key={job.id} job={job} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />
      </aside>
    </div>,
    document.body
  );
}
