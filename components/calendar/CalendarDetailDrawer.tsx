"use client";

import { useEffect } from "react";
import type { EventKind, Job, JobStatus, TeamEvent } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";

export type Selected =
  | { type: "job"; job: Job; status: JobStatus }
  | { type: "event"; event: TeamEvent }
  | null;

const KIND_LABEL: Record<EventKind, string> = {
  meeting: "Rapat",
  event: "Event",
  holiday: "Libur",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </>
  );
}

export default function CalendarDetailDrawer({
  selected,
  onClose,
  onDeleteEvent,
  deleting,
  deleteError,
}: {
  selected: Selected;
  onClose: () => void;
  onDeleteEvent: (event: TeamEvent) => void;
  deleting: boolean;
  deleteError: string | null;
}) {
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Detail kalender" className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              {selected.type === "job" ? selected.job.model : KIND_LABEL[selected.event.kind]}
            </div>
            <h2 className="mt-1 text-xl font-bold leading-snug">
              {selected.type === "job" ? selected.job.jobItem : selected.event.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup detail" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg hover:bg-slate-50">
            ×
          </button>
        </div>

        {selected.type === "job" ? (
          <>
            <StatusBadge status={selected.status} />
            <ProgressBar value={selected.job.progress} />
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2.5 text-sm">
              <Row label="Modul">{selected.job.module || "-"}</Row>
              <Row label="Stage">{selected.job.stage || "-"}</Row>
              <Row label="PIC">{selected.job.assignee || "-"}</Row>
              <Row label="Mulai">{fmtDate(selected.job.startDate)}</Row>
              <Row label="Selesai">{fmtDate(selected.job.endDate)}</Row>
            </dl>
            {selected.job.detail && (
              <section>
                <h3 className="mb-1.5 text-sm font-bold">Detail job</h3>
                <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{selected.job.detail}</p>
              </section>
            )}
            <p className="mt-auto text-xs text-slate-500">Untuk mengubah job, buka halaman Monitoring Job.</p>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2.5 text-sm">
              <Row label="Jenis">{KIND_LABEL[selected.event.kind]}</Row>
              <Row label="Mulai">{fmtDate(selected.event.start)}</Row>
              {selected.event.end && <Row label="Selesai">{fmtDate(selected.event.end)}</Row>}
            </dl>
            {deleteError && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{deleteError}</p>}
            <div className="mt-auto border-t border-slate-100 pt-4">
              <button type="button" onClick={() => onDeleteEvent(selected.event)} disabled={deleting} className="h-10 w-full rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                {deleting ? "Menghapus..." : "Hapus event"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
