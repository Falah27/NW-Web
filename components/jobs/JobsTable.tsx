"use client";

import { useMemo, useState, useTransition } from "react";
import type { Job, JobStatus } from "@/lib/types";
import { computeStatus } from "@/lib/status";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import JobDetailDrawer from "@/components/jobs/JobDetailDrawer";
import JobFormDrawer from "@/components/jobs/JobFormDrawer";
import { deleteJobAction } from "@/app/jobs/actions";

const ALL = "all";

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
      >
        <option value={ALL}>{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function JobsTable({ jobs, members, today }: { jobs: Job[]; members: string[]; today: string }) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState(ALL);
  const [mod, setMod] = useState(ALL);
  const [stage, setStage] = useState(ALL);
  const [pic, setPic] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState<(Job & { status: JobStatus }) | null>(null);
  const [form, setForm] = useState<{ job: Job | null } | null>(null);
  const [, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const withStatus = useMemo(
    () => jobs.map((j) => ({ ...j, status: computeStatus(j, today) })),
    [jobs, today]
  );

  const uniq = (key: "model" | "module" | "stage" | "assignee") =>
    Array.from(new Set(jobs.map((j) => j[key]))).sort();

  function handleDelete(job: Job) {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteJobAction(job.id);
      if (result.ok) setSelected(null);
      else setDeleteError(result.error ?? "Terjadi kesalahan tak terduga.");
    });
  }
  const count = (s: JobStatus) => withStatus.filter((j) => j.status === s).length;

  const filtered = withStatus.filter((j) => {
    if (!showClosed && j.archived) return false;
    if (model !== ALL && j.model !== model) return false;
    if (mod !== ALL && j.module !== mod) return false;
    if (stage !== ALL && j.stage !== stage) return false;
    if (pic !== ALL && j.assignee !== pic) return false;
    if (status !== ALL && j.status !== status) return false;
    if (q) {
      const text = `${j.jobItem} ${j.detail ?? ""}`.toLowerCase();
      if (!text.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((j) => {
      map.set(j.model, [...(map.get(j.model) ?? []), j]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const stats = [
    { label: "Total job", value: jobs.length, filter: ALL },
    { label: "Running", value: count("Running"), filter: "Running" },
    { label: "Open", value: count("Open"), filter: "Open" },
    { label: "Over", value: count("Over"), filter: "Over" },
    { label: "Closed", value: count("Closed"), filter: "Closed" },
  ];

  function selectSummaryFilter(filter: string) {
    setStatus(filter);
    if (filter === ALL || filter === "Closed") setShowClosed(true);
  }

  return (
    <div className="flex flex-col gap-5" data-drawer-open={selected ? "true" : "false"}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={status === s.filter}
            onClick={() => selectSummaryFilter(s.filter)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              status === s.filter ? "border-brand ring-2 ring-brand/15" : "border-slate-200"
            }`}
          >
            <div className="text-sm font-medium text-slate-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{s.value}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
          Cari
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Job item atau detail"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
          />
        </label>
        <Select label="Model" value={model} onChange={setModel} options={uniq("model")} allLabel="Semua model" />
        <Select label="Modul" value={mod} onChange={setMod} options={uniq("module")} allLabel="Semua modul" />
        <Select label="Stage" value={stage} onChange={setStage} options={uniq("stage")} allLabel="Semua stage" />
        <Select label="PIC" value={pic} onChange={setPic} options={uniq("assignee")} allLabel="Semua PIC" />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={["Running", "Open", "Over", "Closed"]}
          allLabel="Semua status"
        />
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="h-4 w-4"
          />
          Tampilkan job selesai
        </label>
      </div>

      {deleteError && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Gagal menghapus job: {deleteError}
        </div>
      )}

      <div className="max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="data-table w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">Job</th>
              <th className="px-4 py-3 font-semibold">PIC</th>
              <th className="px-4 py-3 font-semibold">Progress</th>
              <th className="px-4 py-3 font-semibold">Jadwal</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Tidak ada job yang cocok dengan filter.
                </td>
              </tr>
            )}
            {grouped.map(([modelName, rows]) => (
              <GroupRows
                key={modelName}
                modelName={modelName}
                rows={rows}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-500">
        Menampilkan {filtered.length} job. Status dihitung otomatis dari progress dan tanggal.
      </p>
      <JobDetailDrawer
        job={selected}
        today={today}
        onClose={() => setSelected(null)}
        onEdit={(j) => {
          setSelected(null);
          setForm({ job: j });
        }}
        onDelete={handleDelete}
      />
      {form && (
        <JobFormDrawer
          job={form.job}
          members={members}
          models={uniq("model")}
          modules={uniq("module").filter(Boolean)}
          stages={uniq("stage").filter(Boolean)}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

function GroupRows({
  modelName,
  rows,
  selectedId,
  onSelect,
}: {
  modelName: string;
  rows: (Job & { status: JobStatus })[];
  selectedId: string | null;
  onSelect: (job: Job & { status: JobStatus }) => void;
}) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={5} className="px-4 py-2.5 text-[13px] font-bold">
          {modelName} <span className="font-medium text-slate-500">· {rows.length} job</span>
        </td>
      </tr>
      {rows.map((j) => (
        <tr
          key={j.id}
          onClick={() => onSelect(j)}
          aria-current={selectedId === j.id ? "true" : undefined}
          className={`cursor-pointer border-t border-slate-200 align-top transition-colors hover:bg-slate-50 ${
            selectedId === j.id ? "bg-brand-soft shadow-[inset_4px_0_0_#2b4acb]" : ""
          }`}
        >
          <td className="px-4 py-3.5">
            <button type="button" className="text-left font-semibold hover:text-brand">
              {j.jobItem}
            </button>
            <div className="mt-0.5 text-xs text-slate-500">
              {j.module} · {j.stage}
            </div>
            {j.detail && (
              <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{j.detail}</div>
            )}
          </td>
          <td className="whitespace-nowrap px-4 py-3.5">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                {initials(j.assignee)}
              </span>
              {j.assignee}
            </span>
          </td>
          <td className="px-4 py-3.5">
            <ProgressBar value={j.progress} />
          </td>
          <td className="whitespace-nowrap px-4 py-3.5 text-[13px]">
            {fmt(j.startDate)} – {fmt(j.endDate)}
          </td>
          <td className="px-4 py-3.5">
            <StatusBadge status={j.status} />
          </td>
        </tr>
      ))}
    </>
  );
}
