"use client";

import { useState, useTransition } from "react";
import { syncSotAction } from "@/app/jobs/sot-sync-action";

export default function SotSyncButton() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message?: string; error?: string }>({ ok: false });
  const [pending, startTransition] = useTransition();

  function sync() {
    setState({ ok: false });
    startTransition(async () => setState(await syncSotAction()));
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState({ ok: false }); }} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">
        Sinkron SOT
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => !pending && setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Sinkron project SOT" className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Sinkron project SOT</h2>
            <p className="mt-1 text-sm text-slate-500">Aplikasi akan membaca daftar project dan target model dari SOT melalui jaringan kantor.</p>
            {state.error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>}
            {state.ok && state.message && <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>}
            <p className="mt-4 text-xs text-slate-500">Jika SOT meminta login, isi <code>SOT_COOKIE</code> di environment server dan restart aplikasi.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold disabled:opacity-60">Tutup</button>
              {!state.ok && <button type="button" onClick={sync} disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Menyinkronkan..." : "Mulai sinkron"}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
