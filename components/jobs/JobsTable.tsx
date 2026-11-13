"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Job, JobStatus } from "@/lib/types";
import { computeStatus } from "@/lib/status";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import JobDetailDrawer from "@/components/jobs/JobDetailDrawer";
import JobFormDrawer from "@/components/jobs/JobFormDrawer";
import { deleteJobAction } from "@/app/jobs/actions";
import FilterChip from "@/components/ui/FilterChip";
import CountUp from "@/components/ui/CountUp";
import EmptyState from "@/components/ui/EmptyState";

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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [model, setModel] = useState(() => searchParams.get("model") ?? ALL);
  const [mod, setMod] = useState(() => searchParams.get("mod") ?? ALL);
  const [stage, setStage] = useState(() => searchParams.get("stage") ?? ALL);
  const [pic, setPic] = useState(() => searchParams.get("pic") ?? ALL);
  const [status, setStatus] = useState(() => searchParams.get("status") ?? ALL);
  const [showClosed, setShowClosed] = useState(() => searchParams.get("showClosed") === "1");
  const [selected, setSelected] = useState<(Job & { status: JobStatus }) | null>(null);
  const [form, setForm] = useState<{ job: Job | null } | null>(null);
  const [, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deferredQ = useDeferredValue(q);

  function updateUrl(name: string, value: string | boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || value === ALL || value === false) params.delete(name);
    else params.set(name, value === true ? "1" : value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setFilter(name: string, value: string) {
    updateUrl(name, value);
    if (name === "q") setQ(value);
    if (name === "model") setModel(value);
    if (name === "mod") setMod(value);
    if (name === "stage") setStage(value);
    if (name === "pic") setPic(value);
    if (name === "status") setStatus(value);
  }

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
    if (deferredQ) {
      const text = `${j.jobItem} ${j.detail ?? ""}`.toLowerCase();
      if (!text.includes(deferredQ.toLowerCase())) return false;
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
    const revealClosed = filter === ALL || filter === "Closed";
    if (revealClosed) setShowClosed(true);
    const params = new URLSearchParams(searchParams.toString());
    if (filter === ALL) params.delete("status"); else params.set("status", filter);
    if (revealClosed) params.set("showClosed", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    setQ("");
    setModel(ALL);
    setMod(ALL);
    setStage(ALL);
    setPic(ALL);
    setStatus(ALL);
    setShowClosed(false);
    router.replace(pathname, { scroll: false });
  }

  function requestImport() {
    window.dispatchEvent(new Event("open-excel-sync"));
  }
  const hasFilters = Boolean(q || model !== ALL || mod !== ALL || stage !== ALL || pic !== ALL || status !== ALL || showClosed);

  return (
    <div className="flex flex-col gap-5" data-drawer-open={selected ? "true" : "false"}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s, index) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={status === s.filter}
            onClick={() => selectSummaryFilter(s.filter)}
            style={{ "--i": index } as React.CSSProperties}
            className={`card card-stagger rounded-2xl p-4 text-left transition hover:shadow-md ${
              status === s.filter ? "border-brand ring-2 ring-brand/15" : "border-slate-200"
            }`}
          >
            <div className="text-sm font-medium text-slate-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight"><CountUp value={s.value} /></div>
          </button>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
          Cari
          <input
            value={q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Job item atau detail"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
          />
        </label>
        <Select label="Model" value={model} onChange={(value) => setFilter("model", value)} options={uniq("model")} allLabel="Semua model" />
        <Select label="Modul" value={mod} onChange={(value) => setFilter("mod", value)} options={uniq("module")} allLabel="Semua modul" />
        <Select label="Stage" value={stage} onChange={(value) => setFilter("stage", value)} options={uniq("stage")} allLabel="Semua stage" />
        <Select label="PIC" value={pic} onChange={(value) => setFilter("pic", value)} options={uniq("assignee")} allLabel="Semua PIC" />
        <Select
          label="Status"
          value={status}
          onChange={(value) => setFilter("status", value)}
          options={["Running", "Open", "Over", "Closed"]}
          allLabel="Semua status"
        />
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => { setShowClosed(e.target.checked); updateUrl("showClosed", e.target.checked); }}
            className="h-4 w-4"
          />
          Tampilkan job selesai
        </label>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filter aktif">
          <span className="text-xs font-semibold text-slate-500">Filter aktif:</span>
          {q && <FilterChip label={`Cari: ${q}`} onRemove={() => setFilter("q", "")} />}
          {model !== ALL && <FilterChip label={`Model: ${model}`} onRemove={() => setFilter("model", ALL)} />}
          {mod !== ALL && <FilterChip label={`Modul: ${mod}`} onRemove={() => setFilter("mod", ALL)} />}
          {stage !== ALL && <FilterChip label={`Stage: ${stage}`} onRemove={() => setFilter("stage", ALL)} />}
          {pic !== ALL && <FilterChip label={`PIC: ${pic}`} onRemove={() => setFilter("pic", ALL)} />}
          {status !== ALL && <FilterChip label={`Status: ${status}`} onRemove={() => setFilter("status", ALL)} />}
          {showClosed && <FilterChip label="Job selesai ditampilkan" onRemove={() => { setShowClosed(false); updateUrl("showClosed", false); }} />}
          <button type="button" onClick={clearFilters} className="px-2 text-xs font-semibold text-slate-500 transition hover:text-brand">
            Reset semua
          </button>
        </div>
      )}

      {deleteError && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Gagal menghapus job: {deleteError}
        </div>
      )}

      <div className="surface hidden max-h-[58vh] overflow-auto rounded-xl shadow-sm md:block">
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
                  <EmptyState
                    title={jobs.length === 0 ? "Belum ada job" : "Tidak ada job yang cocok"}
                    description={jobs.length === 0 ? "Impor workbook Excel untuk mulai mengisi daftar job." : "Coba ubah kata kunci atau reset filter yang aktif."}
                    action={jobs.length === 0 ? { label: "Impor Excel", onClick: requestImport } : { label: "Reset filter", onClick: clearFilters }}
                  />
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

        <p className="mt-3 text-sm text-slate-500">
          Menampilkan {filtered.length} job. Status dihitung otomatis dari progress dan tanggal.
        </p>

      <div className="grid gap-3 md:hidden">
        {filtered.map((job) => (
          <MobileJobCard key={job.id} job={job} selectedId={selected?.id ?? null} onSelect={setSelected} />
        ))}
        {filtered.length === 0 && <div className="card"><EmptyState title={jobs.length === 0 ? "Belum ada job" : "Tidak ada job yang cocok"} description={jobs.length === 0 ? "Impor workbook Excel untuk mulai mengisi daftar job." : "Coba ubah kata kunci atau reset filter yang aktif."} action={jobs.length === 0 ? { label: "Impor Excel", onClick: requestImport } : { label: "Reset filter", onClick: clearFilters }} /></div>}
      </div>
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

function MobileJobCard({
  job,
  selectedId,
  onSelect,
}: {
  job: Job & { status: JobStatus };
  selectedId: string | null;
  onSelect: (job: Job & { status: JobStatus }) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(job)}
      aria-current={selectedId === job.id ? "true" : undefined}
      className={`card flex w-full flex-col gap-3 p-4 text-left transition ${selectedId === job.id ? "border-brand bg-brand-soft" : "hover:border-brand/40"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{job.model}</p>
          <p className="mt-1 font-bold text-slate-900">{job.jobItem}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{initials(job.assignee)}</span>
        {job.assignee}
      </div>
      <ProgressBar value={job.progress} />
      <p className="tabular-nums text-xs text-slate-500">{fmt(job.startDate)} – {fmt(job.endDate)}</p>
    </button>
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
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(j);
            }
          }}
          role="button"
          tabIndex={0}
          aria-current={selectedId === j.id ? "true" : undefined}
          className={`cursor-pointer border-t border-slate-200 align-top transition-colors hover:bg-slate-50 ${
            selectedId === j.id ? "bg-brand-soft shadow-[inset_4px_0_0_#2b4acb]" : ""
          }`}
        >
          <td className="px-4 py-3.5">
            <span className="text-left font-semibold hover:text-brand">
              {j.jobItem}
            </span>
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
