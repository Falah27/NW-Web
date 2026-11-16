"use client";

import { startTransition, useActionState, useEffect } from "react";
import type { Job } from "@/lib/types";
import { saveJobAction, type FormState } from "@/app/jobs/actions";
import { SOT_ERROR, SOT_HTML_PATTERN } from "@/lib/sot";
import Drawer, { DrawerBody, DrawerFooter, DrawerHeader, FormField, inputClass, textareaClass } from "@/components/ui/Drawer";

const initialState: FormState = { ok: false };

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
    <Drawer onClose={onClose} label={job ? "Edit job" : "Tambah job"} size="md">
      <DrawerHeader title={job ? "Edit job" : "Tambah job"} onClose={requestClose} />
      <DrawerBody>
        <div className="hidden">
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

        <form id="job-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {job && <input type="hidden" name="id" value={job.id} />}

          <FormField label="Model *">
            <input name="model" list="dl-models" required defaultValue={job?.model ?? ""} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Modul">
              <input name="module" list="dl-modules" defaultValue={job?.module ?? ""} className={inputClass} />
            </FormField>
            <FormField label="Stage">
              <input name="stage" list="dl-stages" defaultValue={job?.stage ?? ""} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Job item *">
            <input name="jobItem" required defaultValue={job?.jobItem ?? ""} className={inputClass} />
          </FormField>
          <FormField label="PIC *">
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
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Start date">
              <input type="date" name="startDate" defaultValue={job?.startDate ?? ""} className={inputClass} />
            </FormField>
            <FormField label="End date">
              <input type="date" name="endDate" defaultValue={job?.endDate ?? ""} className={inputClass} />
            </FormField>
            <FormField label="Progress (%)">
              <input
                type="number"
                name="progress"
                min={0}
                max={100}
                step={1}
                defaultValue={job ? Math.round(job.progress * 100) : 0}
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="SOT No">
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
            </FormField>
            <FormField label="SOT Status">
              <input name="sotStatus" defaultValue={job?.sotStatus ?? ""} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Detail job">
            <textarea name="detail" rows={3} defaultValue={job?.detail ?? ""} className={textareaClass} />
          </FormField>
          <FormField label="Remarks">
            <textarea name="remarks" rows={3} defaultValue={job?.remarks ?? ""} className={textareaClass} />
          </FormField>

          <datalist id="dl-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="dl-modules">{modules.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="dl-stages">{stages.map((m) => <option key={m} value={m} />)}</datalist>

          {state.error && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              {state.error}
            </p>
          )}

          <div className="hidden">
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
      </DrawerBody>
      <DrawerFooter><button type="button" onClick={requestClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Batal</button><button form="job-form" type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Menyimpan..." : "Simpan"}</button></DrawerFooter>
    </Drawer>
  );
}
