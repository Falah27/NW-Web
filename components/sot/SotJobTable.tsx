"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSotManualMappingAction } from "@/app/sot-job/actions";
import type { SotJobModelGroup, SotJobProject } from "@/lib/sot-job-repo";

const ALL = "all";

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

function ProjectDrawer({
  project,
  modelGroups,
  onClose,
}: {
  project: SotJobProject;
  modelGroups: SotJobModelGroup[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(sourceName: string, value: string) {
    setError(null);
    const modelGroupId = value ? Number(value) : null;
    startTransition(async () => {
      const result = await saveSotManualMappingAction(project.id, sourceName, modelGroupId);
      if (!result.ok) {
        setError(result.error ?? "Gagal menyimpan mapping.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detail project ${project.projectName}`}
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">{project.fy}</p>
            <h2 className="text-2xl font-bold">{project.projectName}</h2>
            <p className="mt-1 text-sm text-slate-500">Diperbarui {formatDate(project.updatedAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
            Tutup
          </button>
        </div>
        <a href={project.projectLink} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          Buka project di SOT ↗
        </a>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <section className="mt-6">
          <h3 className="text-lg font-bold">Target model dan mapping</h3>
          {project.targets.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Project ini belum memiliki target model.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {project.targets.map((target) => (
                <div key={target.sourceName} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold">{target.sourceName}</p>
                  <p className={`mt-1 text-xs ${target.status === "matched" ? "text-emerald-700" : "text-amber-700"}`}>
                    {target.groupName ? `Mapping: ${target.groupName}` : "Belum memiliki mapping"}
                    {target.method ? ` · ${target.method}` : ""}
                  </p>
                  <label className="mt-3 block text-xs font-semibold text-slate-600">
                    Pilih model group
                    <select
                      disabled={pending}
                      defaultValue={target.groupName ? modelGroups.find((group) => group.name === target.groupName)?.id.toString() ?? "" : ""}
                      onChange={(event) => save(target.sourceName, event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
                    >
                      <option value="">Belum dipetakan</option>
                      {modelGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

export default function SotJobTable({ projects, modelGroups }: { projects: SotJobProject[]; modelGroups: SotJobModelGroup[] }) {
  const [query, setQuery] = useState("");
  const [fy, setFy] = useState(ALL);
  const [mapping, setMapping] = useState(ALL);
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedProject, setSelectedProject] = useState<SotJobProject | null>(null);
  const fys = useMemo(() => [...new Set(projects.map((project) => project.fy))], [projects]);
  const filtered = useMemo(
    () =>
      projects.filter((project) => {
        if (activeOnly && !project.isActive) return false;
        if (fy !== ALL && project.fy !== fy) return false;
        const text = `${project.projectName} ${project.fy} ${project.targets.map((target) => `${target.sourceName} ${target.groupName ?? ""}`).join(" ")}`.toLowerCase();
        if (query && !text.includes(query.toLowerCase())) return false;
        if (mapping === "unmatched" && !project.targets.some((target) => target.status === "needs_mapping")) return false;
        if (mapping === "matched" && (project.targets.length === 0 || project.targets.some((target) => target.status !== "matched"))) return false;
        if (mapping === "empty" && project.targets.length > 0) return false;
        return true;
      }),
    [activeOnly, fy, mapping, projects, query]
  );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-600">
            Cari project atau model
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama project atau target model" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            FY
            <select value={fy} onChange={(event) => setFy(event.target.value)} className="mt-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
              <option value={ALL}>Semua FY</option>
              {fys.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Mapping
            <select value={mapping} onChange={(event) => setMapping(event.target.value)} className="mt-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
              <option value={ALL}>Semua status</option>
              <option value="matched">Semua cocok</option>
              <option value="unmatched">Ada belum cocok</option>
              <option value="empty">Belum ada target</option>
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="h-4 w-4" />
            Project aktif saja
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead><tr className="bg-slate-100 text-left text-xs text-slate-500"><th className="px-4 py-3 font-semibold">FY</th><th className="px-4 py-3 font-semibold">Project</th><th className="px-4 py-3 font-semibold">Target model</th><th className="px-4 py-3 font-semibold">Mapping</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Aksi</th></tr></thead>
            <tbody>
              {filtered.map((project) => {
                const unmatched = project.targets.filter((target) => target.status === "needs_mapping").length;
                return (
                  <tr key={project.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-4 py-4 font-semibold text-slate-600">{project.fy}</td>
                    <td className="px-4 py-4"><a href={project.projectLink} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">{project.projectName} ↗</a><div className="mt-1 text-xs text-slate-400">Diperbarui {formatDate(project.updatedAt)}</div></td>
                    <td className="px-4 py-4">{project.targets.length === 0 ? <span className="text-slate-400">Belum ada target model</span> : <div className="flex flex-wrap gap-1.5">{project.targets.map((target) => <span key={target.sourceName} className="rounded-md bg-slate-100 px-2 py-1 text-xs">{target.sourceName}</span>)}</div>}</td>
                    <td className="px-4 py-4">{project.targets.length === 0 ? "-" : <div className="flex flex-col gap-1 text-xs">{project.targets.map((target) => <span key={`${target.sourceName}-mapping`} className={target.status === "matched" ? "text-emerald-700" : "text-amber-700"}>{target.groupName ?? "Belum cocok"}{target.method && target.method !== "exact" ? ` (${target.method})` : ""}</span>)}</div>}</td>
                    <td className="px-4 py-4">{!project.isActive ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Tidak aktif</span> : project.targets.length === 0 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Tanpa target</span> : unmatched > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{unmatched} belum cocok</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Cocok</span>}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedProject(project)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                      >
                        Mapping manual
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Tidak ada project sesuai filter.</p>}
        </div>
      </section>
      {selectedProject && <ProjectDrawer project={selectedProject} modelGroups={modelGroups} onClose={() => setSelectedProject(null)} />}
    </>
  );
}
