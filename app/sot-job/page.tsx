import { Suspense } from "react";
import { connection } from "next/server";
import SotJobTable from "@/components/sot/SotJobTable";
import SotSyncButton from "@/components/jobs/SotSyncButton";
import ClearSotDataButton from "@/components/sot/ClearSotDataButton";
import { getSotJobData, getSotJobModelGroups } from "@/lib/sot-job-repo";
import CountUp from "@/components/ui/CountUp";

async function SotJobContent() {
  await connection();
  const data = getSotJobData();
  const modelGroups = getSotJobModelGroups();
  const lastSync = data.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      })
    : null;

  return (
    <>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          ["Project aktif", data.totals.projects],
          ["FY", data.totals.fys],
          ["Target model", data.totals.targets],
          ["Sudah cocok", data.totals.matched],
          ["Belum cocok", data.totals.unmatched],
        ].map(([label, value], index) => (
          <div key={label} style={{ "--i": index } as React.CSSProperties} className="card card-stagger p-4">
            <div className="text-sm font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight"><CountUp value={value as number} /></div>
          </div>
        ))}
      </section>
      <p className="text-sm text-slate-500">
        {lastSync ? `Sinkronisasi SOT terakhir: ${lastSync}` : "Belum ada sinkronisasi SOT yang berhasil."}
      </p>
      <SotJobTable projects={data.projects} modelGroups={modelGroups} />
    </>
  );
}

export default function SotJobPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SOT Job</h1>
        <p className="mt-1 text-slate-600">Daftar project SOT dan status pencocokan target model.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <SotSyncButton />
          <ClearSotDataButton />
        </div>
      </div>
      <Suspense fallback={<p className="py-10 text-center text-slate-500">Memuat data SOT...</p>}>
        <SotJobContent />
      </Suspense>
    </div>
  );
}
