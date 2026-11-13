import type { JobStatus } from "@/lib/types";

const styles: Record<JobStatus, string> = {
  Closed: "bg-emerald-50 text-emerald-900 border-emerald-300",
  Running: "bg-blue-50 text-blue-900 border-blue-300",
  Open: "bg-slate-100 text-slate-700 border-slate-300",
  Over: "bg-red-50 text-red-900 border-red-300",
  "-": "bg-white text-slate-600 border-slate-300",
};

export default function StatusBadge({ status, compact = false }: { status: JobStatus; compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? `inline-flex items-center px-0 py-0 text-[11px] font-bold uppercase tracking-[0.08em] ${styles[status].replace(/bg-\S+/g, "bg-transparent").replace(/border-\S+/g, "border-0")}`
          : `inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`
      }
    >
      {status}
    </span>
  );
}
