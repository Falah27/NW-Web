"use client";

import { useState } from "react";
import Link from "next/link";
import type { Job } from "@/lib/types";
import { diffDaysISO } from "@/lib/date";
import Drawer, { DrawerBody, DrawerFooter, DrawerHeader } from "@/components/ui/Drawer";
import JobStatusCard, { statusTheme, type JobWithStatus } from "@/components/jobs/JobStatusCard";


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
      <DrawerFooter>
        <Link href="/jobs" className="flex h-10 flex-1 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white transition hover:opacity-90">
          Ubah di Monitoring Job
        </Link>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold transition hover:bg-slate-50">
          Tutup
        </button>
      </DrawerFooter>
    );
  }

  if (confirming) {
    return (
      <DrawerFooter className="flex-col gap-3 border-red-200 bg-red-50">
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
      </DrawerFooter>
    );
  }

  return (
    <DrawerFooter>
      {onEdit && <button type="button" onClick={() => onEdit(job)} className="h-10 flex-1 rounded-lg bg-brand text-sm font-semibold text-white transition hover:opacity-90">Edit job</button>}
      {onDelete && <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50">Hapus</button>}
    </DrawerFooter>
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
  if (!job || typeof document === "undefined") return null;

  const t = statusTheme[job.status];
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

  return (
    <Drawer onClose={onClose} label={`Detail job ${job.jobItem}`} size="md" strip={t.strip}>
          <DrawerHeader eyebrow={job.model} title={job.jobItem} onClose={onClose}>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                  {initials(job.assignee)}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-slate-900">{job.assignee || "-"}</div>
                  <div className="text-xs text-slate-500">Penanggung jawab</div>
                </div>
              </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="hidden">
              ×
            </button>
          </DrawerHeader>

          <DrawerBody>
            <JobStatusCard job={job} today={today} />

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
          </DrawerBody>

        <Footer key={job.id} job={job} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />
    </Drawer>
  );
}
