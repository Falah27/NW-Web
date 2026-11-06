"use client";

import { startTransition, useActionState, useEffect } from "react";
import { saveEventAction, type EventFormState } from "@/app/calendar/actions";

const initialState: EventFormState = { ok: false };
const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900";

export default function EventFormDrawer({ defaultDate, onClose }: { defaultDate?: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(saveEventAction, initialState);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Tambah event" className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">Tambah event</h2>
          <button type="button" onClick={onClose} aria-label="Tutup form" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg hover:bg-slate-50">×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Judul *<input name="title" required maxLength={120} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Jenis<select name="kind" defaultValue="meeting" className={inputClass}><option value="meeting">Rapat</option><option value="event">Event</option><option value="holiday">Libur</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Tanggal mulai *<input type="date" name="start" required defaultValue={defaultDate ?? ""} className={inputClass} /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Tanggal selesai<input type="date" name="end" className={inputClass} /></label>
          </div>
          <p className="text-xs text-slate-500">Kosongkan tanggal selesai untuk event satu hari.</p>
          {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}
