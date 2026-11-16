"use client";

import { startTransition, useActionState, useEffect } from "react";
import { saveEventAction, type EventFormState } from "@/app/calendar/actions";
import Drawer, { DrawerBody, DrawerFooter, DrawerHeader, inputClass } from "@/components/ui/Drawer";

const initialState: EventFormState = { ok: false };

export default function EventFormDrawer({ defaultDate, onClose }: { defaultDate?: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(saveEventAction, initialState);
  const requestClose = onClose;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  useEffect(() => {
    if (state.ok) requestClose();
  }, [state.ok, requestClose]);

  return (
    <Drawer onClose={onClose} label="Tambah event" size="md">
      <DrawerHeader title="Tambah event" onClose={requestClose} />
      <DrawerBody>
        <div className="hidden">
          <h2 className="text-xl font-bold">Tambah event</h2>
          <button type="button" onClick={requestClose} aria-label="Tutup form" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg hover:bg-slate-50">×</button>
        </div>
        <form id="event-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Judul *<input name="title" required maxLength={120} className={inputClass} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Jenis<select name="kind" defaultValue="meeting" className={inputClass}><option value="meeting">Rapat</option><option value="event">Event</option><option value="holiday">Libur</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Tanggal mulai *<input type="date" name="start" required defaultValue={defaultDate ?? ""} className={inputClass} /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Tanggal selesai<input type="date" name="end" className={inputClass} /></label>
          </div>
          <p className="text-xs text-slate-500">Kosongkan tanggal selesai untuk event satu hari.</p>
          {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>}
          <div className="hidden">
            <button type="button" onClick={requestClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </DrawerBody>
      <DrawerFooter><button type="button" onClick={requestClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Batal</button><button form="event-form" type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Menyimpan..." : "Simpan"}</button></DrawerFooter>
    </Drawer>
  );
}
