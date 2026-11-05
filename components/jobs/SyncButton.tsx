"use client";

import { useActionState, useEffect, useState } from "react";
import { syncExcelAction, type SyncState } from "@/app/jobs/sync-action";

const initialState: SyncState = { ok: false };

export default function SyncButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
      >
        Sinkron sekarang
      </button>
      {open && <SyncDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SyncDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(syncExcelAction, initialState);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={() => !pending && onClose()} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Sinkron dari Excel" className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">Sinkron dari Excel</h2>
        <p className="mt-1 text-sm text-slate-500">
          Unggah workbook FY26 (.xlsm atau .xlsx). Job hasil import sebelumnya akan diganti dengan isi file ini.
        </p>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            File Excel *
            <input type="file" name="file" accept=".xlsm,.xlsx" required className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Nama sheet
            <input name="sheet" defaultValue="Job_Follow_Up" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
          </label>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>Job yang dibuat manual dan data member (role, skills, email) tidak dihapus.</li>
            <li>Perubahan manual pada job hasil Excel akan tertimpa.</li>
          </ul>
          {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>}
          {state.ok && state.message && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={pending} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">{state.ok ? "Tutup" : "Batal"}</button>
            {!state.ok && <button type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Mengimpor..." : "Mulai sinkron"}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
