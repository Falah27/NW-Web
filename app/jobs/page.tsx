import { Suspense } from "react";
import { connection } from "next/server";
import JobsTable from "@/components/jobs/JobsTable";
import AddJobButton from "@/components/jobs/AddJobButton";
import { getJobs, getMembers } from "@/lib/jobs-repo";

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

export default function JobsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FY26 Network Job Follow Up</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-600" />
            Tersinkron dengan Excel · [terakhir sinkron]
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">
            Sinkron sekarang
          </button>
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