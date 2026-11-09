import { Suspense } from "react";
import { connection } from "next/server";
import JobsTable from "@/components/jobs/JobsTable";
import AddJobButton from "@/components/jobs/AddJobButton";
import SyncButton from "@/components/jobs/SyncButton";
import SotSyncButton from "@/components/jobs/SotSyncButton";
import { getJobs, getMembers } from "@/lib/jobs-repo";
import { getLastSync } from "@/lib/xlsm-import";

async function JobsContent() {
  await connection();
  const jobs = getJobs();
  const members = getMembers().map((m) => m.name);
  return <JobsTable jobs={jobs} members={members} />;
}

async function AddJobButtonLoader() {
  await connection();
  const jobs = getJobs();
  const uniq = (key: "model" | "module" | "stage") =>
    Array.from(new Set(jobs.map((j) => j[key]).filter(Boolean))).sort();
  return (
    <AddJobButton
      members={getMembers().map((m) => m.name)}
      models={uniq("model")}
      modules={uniq("module")}
      stages={uniq("stage")}
    />
  );
}

async function LastSyncText() {
  await connection();
  const last = getLastSync();
  const when = last
    ? new Date(last.at).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      })
    : null;
  return (
    <p className="mt-1.5 text-sm text-slate-500">
      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${last ? "bg-green-600" : "bg-slate-400"}`} />
      {last ? `Tersinkron dengan Excel · ${when} · ${last.file}` : "Belum pernah sinkron dari Excel"}
    </p>
  );
}

export default function JobsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FY26 Network Job Follow Up</h1>
          <Suspense fallback={<p className="mt-1.5 text-sm text-slate-500">Memuat status sinkron...</p>}>
            <LastSyncText />
          </Suspense>
        </div>
        <div className="flex gap-2">
          <SotSyncButton />
          <SyncButton />
          <Suspense
            fallback={
              <button
                disabled
                className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white opacity-60"
              >
                + Tambah Job
              </button>
            }
          >
            <AddJobButtonLoader />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<p className="py-10 text-center text-slate-500">Memuat data job...</p>}>
        <JobsContent />
      </Suspense>
    </div>
  );
}