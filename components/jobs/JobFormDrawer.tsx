"use client";

import { startTransition, useActionState, useEffect } from "react";
import type { Job } from "@/lib/types";
import { saveJobAction, type FormState } from "@/app/jobs/actions";
import { SOT_ERROR, SOT_HTML_PATTERN } from "@/lib/sot";
import useDialogFocus from "@/components/ui/useDialogFocus";
import useDialogTransition from "@/components/ui/useDialogTransition";

const initialState: FormState = { ok: false };

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900";
const textareaClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

export default function JobFormDrawer({
  job,
  members,
  models,
  modules,
  stages,
  onClose,
}: {
  job: Job | null; // null = tambah job baru
  members: string[];
  models: string[];
  modules: string[];
  stages: string[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveJobAction, initialState);
  const { closing, requestClose } = useDialogTransition({ onClose });
  const dialogRef = useDialogFocus<HTMLElement>({ open: true, onClose: requestClose });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  useEffect(() => {
    if (state.ok) requestClose();
  }, [state.ok, requestClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className={`${closing ? "drawer-overlay-out" : "drawer-overlay-in"} absolute inset-0 bg-slate-900/30`} onClick={requestClose} aria-hidden="true" />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={job ? "Edit job" : "Tambah job"}
        className={`${closing ? "drawer-out" : "drawer-in"} absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white p-6 shadow-xl`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{job ? "Edit job" : "Tambah job"}</h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Tutup form"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-300 text-lg hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {job && <input type="hidden" name="id" value={job.id} />}

          <Field label="Model *">
            <input name="model" list="dl-models" required defaultValue={job?.model ?? ""} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modul">
              <input name="module" list="dl-modules" defaultValue={job?.module ?? ""} className={inputClass} />
            </Field>
            <Field label="Stage">
              <input name="stage" list="dl-stages" defaultValue={job?.stage ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Job item *">
            <input name="jobItem" required defaultValue={job?.jobItem ?? ""} className={inputClass} />
          </Field>
          <Field label="PIC *">
            <select name="assignee" required defaultValue={job?.assignee ?? ""} className={inputClass}>
              <option value="" disabled>
                Pilih PIC
              </option>
              {members.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start date">
              <input type="date" name="startDate" defaultValue={job?.startDate ?? ""} className={inputClass} />
            </Field>
            <Field label="End date">
              <input type="date" name="endDate" defaultValue={job?.endDate ?? ""} className={inputClass} />
            </Field>
            <Field label="Progress (%)">
              <input
                type="number"
                name="progress"
                min={0}
                max={100}
                step={1}
                defaultValue={job ? Math.round(job.progress * 100) : 0}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SOT No">
              <input
                name="sotNo"
                defaultValue={job?.sotNo ?? ""}
                inputMode="numeric"
                pattern={SOT_HTML_PATTERN}
                maxLength={6}
                placeholder="203038"
                title={SOT_ERROR}
                className={inputClass}
              />
            </Field>
            <Field label="SOT Status">
              <input name="sotStatus" defaultValue={job?.sotStatus ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Detail job">
            <textarea name="detail" rows={3} defaultValue={job?.detail ?? ""} className={textareaClass} />
          </Field>
          <Field label="Remarks">
            <textarea name="remarks" rows={3} defaultValue={job?.remarks ?? ""} className={textareaClass} />
          </Field>

          <datalist id="dl-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="dl-modules">{modules.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="dl-stages">{stages.map((m) => <option key={m} value={m} />)}</datalist>

          {state.error && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={requestClose}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
