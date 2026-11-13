import { Suspense } from "react";
import { connection } from "next/server";
import SotIssueSyncButton from "@/components/sot/SotIssueSyncButton";
import SotIssueTable from "@/components/sot/SotIssueTable";
import { getSotIssueData } from "@/lib/sot-issues-repo";
import { IssueSkeleton } from "@/components/ui/Skeleton";

// Semua yang membaca env/database ada di sini (setelah connection()), supaya tidak ikut terbekukan saat build.
async function SotIssueContent() {
  await connection();
  const data = getSotIssueData();
  const lastSync = data.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SOT Issue</h1>
          <p className="mt-1 text-slate-600">Job SOT yang dibaca langsung dari SOT sesuai filter di konfigurasi.</p>
        </div>
        <SotIssueSyncButton disabled={!data.canSync} />
      </div>
      {data.configProblem && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Konfigurasi SOT belum lengkap</p>
          <p className="mt-1">{data.configProblem}</p>
          <p className="mt-1 text-amber-800">Isi di <code>.env.local</code> (lihat <code>.env.example</code>), lalu restart <code>npm run dev</code>.</p>
        </div>
      )}
      <p className="text-sm text-slate-500">
        {lastSync ? `Sinkronisasi terakhir: ${lastSync}` : "Belum ada sinkronisasi."}
        {data.filterSummary ? ` · Filter: ${data.filterSummary}` : ""}
      </p>
      <SotIssueTable issues={data.issues} columns={data.columns} issueBaseUrl={data.issueBaseUrl} />
    </div>
  );
}

export default function SotIssuesPage() {
  return (
    <Suspense fallback={<IssueSkeleton />}>
      <SotIssueContent />
    </Suspense>
  );
}
