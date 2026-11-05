import { Suspense } from "react";
import { connection } from "next/server";
import JobCalendar from "@/components/calendar/JobCalendar";
import { getJobs } from "@/lib/jobs-repo";
import { getEvents } from "@/lib/events-repo";

async function CalendarContent() {
  await connection();
  const jobs = getJobs();
  const events = getEvents();
  return <JobCalendar jobs={jobs} events={events} />;
}

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kalender Kerja</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Pantau tenggat job, rapat, dan event team. Klik tanggal untuk menambah event.
        </p>
      </div>
      <Suspense fallback={<p className="py-10 text-center text-slate-500">Memuat kalender...</p>}>
        <CalendarContent />
      </Suspense>
    </div>
  );
}