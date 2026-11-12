"use client";

import { useMemo, useState } from "react";
import type { SotIssueColumn, SotIssueRow } from "@/lib/sot-issues-repo";

const ALL = "__all__";
const PAGE = 25;
const JUDGEMENTS: { value: SotIssueRow["judgement"]; label: string }[] = [
  { value: "late", label: "Late" },
  { value: "due_today", label: "Due Today" },
  { value: "on_schedule", label: "On Schedule" },
  { value: "completed", label: "Completed" },
  { value: "unknown", label: "Unknown" },
];

const SUMMARY_CARDS: { value: SotIssueRow["judgement"] | typeof ALL; label: string; note: string }[] = [
  { value: ALL, label: "Total Issue", note: "semua issue" },
  { value: "on_schedule", label: "On Schedule", note: "belum terlambat" },
  { value: "due_today", label: "Due Today", note: "jatuh tempo hari ini" },
  { value: "late", label: "Late", note: "melewati completion date" },
  { value: "completed", label: "Completed", note: "sudah selesai" },
];

function distinct(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function judgementClass(value: SotIssueRow["judgement"]): string {
  if (value === "late") return "bg-red-100 text-red-800";
  if (value === "due_today") return "bg-amber-100 text-amber-800";
  if (value === "on_schedule") return "bg-blue-100 text-blue-800";
  if (value === "completed") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-600";
}

function judgementLabel(value: SotIssueRow["judgement"]): string {
  return JUDGEMENTS.find((item) => item.value === value)?.label ?? "Unknown";
}

export default function SotIssueTable({
  issues,
  columns,
  issueBaseUrl,
}: {
  issues: SotIssueRow[];
  columns: SotIssueColumn[];
  issueBaseUrl: string | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [tracker, setTracker] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [model, setModel] = useState(ALL);
  const [judgement, setJudgement] = useState(ALL);
  const [page, setPage] = useState(1);

  const statuses = useMemo(() => distinct(issues.map((i) => i.status)), [issues]);
  const trackers = useMemo(() => distinct(issues.map((i) => i.tracker)), [issues]);
  const assignees = useMemo(() => distinct(issues.map((i) => i.assignedTo)), [issues]);
  const modelFieldId = useMemo(
    () => columns.find((column) => column.id === "1" || column.label === "対象機種")?.id ?? "1",
    [columns]
  );
  const models = useMemo(() => distinct(issues.map((issue) => issue.fields[modelFieldId] ?? "")), [issues, modelFieldId]);
  const judgementCounts = useMemo(
    () => issues.reduce<Record<string, number>>((counts, issue) => ({ ...counts, [issue.judgement]: (counts[issue.judgement] ?? 0) + 1 }), {}),
    [issues]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (status !== ALL && issue.status !== status) return false;
      if (tracker !== ALL && issue.tracker !== tracker) return false;
      if (assignee !== ALL && issue.assignedTo !== assignee) return false;
      if (model !== ALL && issue.fields[modelFieldId] !== model) return false;
      if (judgement !== ALL && issue.judgement !== judgement) return false;
      if (!needle) return true;
      const haystack = [issue.id, issue.subject, issue.tracker, issue.status, issue.assignedTo, issue.fixedVersion, issue.project, ...Object.values(issue.fields)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [issues, query, status, tracker, assignee, model, judgement, modelFieldId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const activePage = Math.min(page, pageCount);
  const shown = filtered.slice((activePage - 1) * PAGE, activePage * PAGE);
  const firstShown = filtered.length === 0 ? 0 : (activePage - 1) * PAGE + 1;
  const lastShown = Math.min(activePage * PAGE, filtered.length);
  const select = "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";
  const th = "sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-3 font-semibold shadow-[0_1px_0_rgba(226,232,240,0.8)]";
  const td = "px-3 py-2.5 align-top";

  function reset<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {SUMMARY_CARDS.map((card) => {
          const count = card.value === ALL ? issues.length : judgementCounts[card.value] ?? 0;
          const active = judgement === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={active}
              onClick={() => { setJudgement(card.value); setPage(1); }}
              className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                active ? "border-brand ring-2 ring-brand/15" : "border-slate-200"
              }`}
            >
              <div className="text-sm font-medium text-slate-500">{card.label}</div>
              <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{count}</div>
              <div className="mt-0.5 text-xs text-slate-500">{card.note}</div>
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
        <label className="min-w-[240px] flex-[1.5] text-xs font-semibold text-slate-600">
          Cari
          <input
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            placeholder="ID, subject, assignee, atau nilai kolom lain"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal"
          />
        </label>
        <label className="w-full text-xs font-semibold text-slate-600 sm:w-36">
          Status
          <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={select}>
            <option value={ALL}>Semua</option>
            {statuses.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="w-full text-xs font-semibold text-slate-600 sm:w-36">
          Tracker
          <select value={tracker} onChange={(e) => reset(setTracker)(e.target.value)} className={select}>
            <option value={ALL}>Semua</option>
            {trackers.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="w-full text-xs font-semibold text-slate-600 sm:min-w-52 sm:flex-1">
          Assigned To
          <select value={assignee} onChange={(e) => reset(setAssignee)(e.target.value)} className={select}>
            <option value={ALL}>Semua</option>
            {assignees.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="w-full text-xs font-semibold text-slate-600 sm:w-44">
          Model
          <select value={model} onChange={(e) => reset(setModel)(e.target.value)} className={select}>
            <option value={ALL}>Semua model</option>
            {models.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="max-h-[62vh] min-h-[240px] overflow-auto">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="bg-slate-100 text-left text-xs text-slate-500">
              <th className={th}>ID</th>
              <th className={th}>Tracker</th>
              <th className={th}>Status</th>
              <th className={`${th} min-w-[320px] max-w-[460px]`}>Subject</th>
              <th className={`${th} min-w-[210px]`}>Assigned To</th>
              <th className={th}>Updated On</th>
              <th className={th}>Completion Date</th>
              <th className={th}>Judgement</th>
              <th className={th}>Fixed Version</th>
              {columns.map((c) => <th key={c.id} className={th} title={`Custom field ${c.id}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((issue) => (
              <tr key={issue.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className={`${td} whitespace-nowrap font-semibold`}>
                  {issueBaseUrl ? (
                    <a href={`${issueBaseUrl}/issues/${issue.id}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                      {issue.id}
                    </a>
                  ) : (
                    issue.id
                  )}
                </td>
                <td className={`${td} whitespace-nowrap`}>{issue.tracker}</td>
                <td className={`${td} whitespace-nowrap`}>{issue.status}</td>
                <td className={`${td} max-w-[460px] whitespace-normal leading-5`}>{issue.subject}</td>
                <td className={`${td} whitespace-nowrap`}>{issue.assignedTo || "-"}</td>
                <td className={`${td} whitespace-nowrap`}>{issue.updatedLabel}</td>
                <td className={`${td} whitespace-nowrap`}>{issue.completionDate || "-"}</td>
                <td className={td}>
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${judgementClass(issue.judgement)}`}>
                    {judgementLabel(issue.judgement)}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{issue.fixedVersion || "-"}</td>
                {columns.map((c) => <td key={c.id} className={td}>{issue.fields[c.id] || "-"}</td>)}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9 + columns.length} className="px-4 py-10 text-center text-slate-500">
                  {issues.length === 0 ? "Belum ada data. Klik \"Sinkron issue SOT\"." : "Tidak ada issue yang cocok dengan pencarian."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>Menampilkan {firstShown}-{lastShown} dari {filtered.length} issue{filtered.length !== issues.length ? ` (total ${issues.length})` : ""}</span>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs text-slate-500">Halaman {activePage} / {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage(Math.max(1, activePage - 1))}
            disabled={activePage === 1}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, activePage + 1))}
            disabled={activePage === pageCount}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>
      </section>
    </div>
  );
}
