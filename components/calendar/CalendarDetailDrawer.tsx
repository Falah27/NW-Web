"use client";

import { useEffect } from "react";
import type { EventKind, JobStatus, TeamEvent } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import type { Job } from "@/lib/types";

export type Selected =
  | { type: "job"; job: Job; status: JobStatus }
  | { type: "event"; event: TeamEvent }
  | null;

const KIND_LABEL: Record<EventKind, string> = { meeting: "Rapat", event: "Event", holiday: "Libur" };

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function DetailRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-slate-50 text-[11px] text-slate-500" aria-hidden="true">{icon}</span>
      <span className="min-w-0 text-sm text-slate-600">{label}</span>
      <span className="ml-auto max-w-[57%] truncate text-right text-sm font-semibold text-slate-900">{children}</span>
    </div>
  );
}

function TimelineItem({ icon, title, description, active = false, last = false }: { icon: string; title: string; description: string; active?: boolean; last?: boolean }) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] border-l border-dashed border-slate-200" aria-hidden="true" />}
      <span className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full border text-xs ${active ? "border-brand bg-brand-soft text-brand" : "border-slate-200 bg-white text-slate-400"}`}>{icon}</span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export default function CalendarDetailDrawer({ selected, onClose, onDeleteEvent, deleting, deleteError }: {
  selected: Selected;
  onClose: () => void;
  onDeleteEvent: (event: TeamEvent) => void;
  deleting: boolean;
  deleteError: string | null;
}) {
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  if (!selected) return null;

  const isJob = selected.type === "job";
  const title = isJob ? selected.job.jobItem : selected.event.title;
  const model = isJob ? selected.job.model : KIND_LABEL[selected.event.kind];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-3">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Detail kalender" className="relative flex h-full w-full max-w-[420px] flex-col overflow-y-auto rounded-none bg-white shadow-2xl sm:max-h-[calc(100vh-1.5rem)] sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 px-4 pb-3.5 pt-4 sm:px-5">
          <div className="min-w-0">
            <p className="line-clamp-2 text-2xl font-bold leading-tight tracking-tight text-slate-950">{title}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{model}</p>
            {isJob && <p className="mt-1 truncate text-xs text-slate-400">{selected.job.assignee || "Tanpa PIC"}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup detail" className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">×</button>
        </header>

        {isJob ? (
          <div className="flex flex-col">
            <section className="border-b border-dashed border-slate-200 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Job detail</p>
              <DetailRow icon="▣" label="Status"><StatusBadge status={selected.status} compact /></DetailRow>
              <DetailRow icon="◷" label="Progress">{Math.round(selected.job.progress * 100)}%</DetailRow>
              <DetailRow icon="◈" label="Modul">{selected.job.module || "-"}</DetailRow>
              <DetailRow icon="◇" label="Stage">{selected.job.stage || "-"}</DetailRow>
            </section>

            <section className="border-b border-dashed border-slate-200 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Schedule</p>
              <DetailRow icon="↗" label="Mulai">{fmtDate(selected.job.startDate)}</DetailRow>
              <DetailRow icon="↘" label="Selesai">{fmtDate(selected.job.endDate)}</DetailRow>
              <div className="mt-1"><ProgressBar value={selected.job.progress} /></div>
            </section>

            {selected.job.detail && (
              <section className="border-b border-dashed border-slate-200 px-4 py-3 sm:px-5">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{selected.job.detail}</p>
              </section>
            )}

            <section className="px-4 py-3 sm:px-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Process history</p>
              <TimelineItem icon="✓" title="Job terdaftar" description={`Model ${selected.job.model} · PIC ${selected.job.assignee || "belum ditentukan"}`} active />
              <TimelineItem icon="↗" title={selected.status === "Closed" ? "Job selesai" : "Dalam pengerjaan"} description={`${Math.round(selected.job.progress * 100)}% progress saat ini`} active={selected.job.progress > 0} />
              <TimelineItem icon="○" title="Deadline" description={fmtDate(selected.job.endDate)} last />
            </section>
            <p className="mt-auto px-5 pb-4 text-xs text-slate-400">Untuk mengubah job, buka halaman Monitoring Job.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <section className="border-b border-dashed border-slate-200 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Event detail</p>
              <DetailRow icon="◇" label="Jenis">{KIND_LABEL[selected.event.kind]}</DetailRow>
              <DetailRow icon="↗" label="Mulai">{fmtDate(selected.event.start)}</DetailRow>
              {selected.event.end && <DetailRow icon="↘" label="Selesai">{fmtDate(selected.event.end)}</DetailRow>}
            </section>
            {deleteError && <p role="alert" className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-5">{deleteError}</p>}
            <div className="mt-auto border-t border-slate-100 px-4 py-3 sm:px-5">
              <button type="button" onClick={() => onDeleteEvent(selected.event)} disabled={deleting} className="h-10 w-full rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">{deleting ? "Menghapus..." : "Hapus event"}</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
