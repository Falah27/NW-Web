import JobsTable from "@/components/jobs/JobsTable";
import { jobs } from "@/lib/mock-data";

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
          <button className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90">
            + Tambah job
          </button>
        </div>
      </div>
      <JobsTable jobs={jobs} />
    </div>
  );
}