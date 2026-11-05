"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import idLocale from "@fullcalendar/core/locales/id";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { Job, JobStatus, TeamEvent } from "@/lib/types";
import { computeStatus } from "@/lib/status";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";

const ALL = "all";

const statusColor: Record<JobStatus, { bg: string; border: string; text: string }> = {
  Running: { bg: "#e8f0fe", border: "#2b4acb", text: "#1e3a8a" },
  Open: { bg: "#f1f5f9", border: "#64748b", text: "#334155" },
  Over: { bg: "#fdecec", border: "#dc2626", text: "#7f1d1d" },
  Closed: { bg: "#e6f4ec", border: "#16a34a", text: "#14532d" },
  "-": { bg: "#ffffff", border: "#94a3b8", text: "#475569" },
};

const kindColor = {
  meeting: { bg: "#fff4e0", border: "#d97706", text: "#78350f" },
  event: { bg: "#f3e8ff", border: "#9333ea", text: "#581c87" },
  holiday: { bg: "#fee2e2", border: "#b91c1c", text: "#7f1d1d" },
};

// FullCalendar memakai tanggal akhir eksklusif untuk event seharian,
// jadi tanggal akhir perlu ditambah 1 hari agar hari terakhir ikut tampil.
function addDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

type Selected =
  | { type: "job"; job: Job; status: JobStatus }
  | { type: "event"; event: TeamEvent }
  | null;

export default function JobCalendar({
  jobs,
  events,
}: {
  jobs: Job[];
  events: TeamEvent[];
}) {
  const [model, setModel] = useState(ALL);
  const [pic, setPic] = useState(ALL);
  const [showClosed, setShowClosed] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [selected, setSelected] = useState<Selected>(null);

  const models = Array.from(new Set(jobs.map((j) => j.model))).sort();
  const pics = Array.from(new Set(jobs.map((j) => j.assignee))).sort();

  const calendarEvents = useMemo<EventInput[]>(() => {
    const jobEvents: EventInput[] = jobs
      .filter((j) => j.startDate && j.endDate)
      .filter((j) => showClosed || !j.archived)
      .filter((j) => model === ALL || j.model === model)
      .filter((j) => pic === ALL || j.assignee === pic)
      .map((j) => {
        const status = computeStatus(j);
        const c = statusColor[status];
        return {
          id: `job-${j.id}`,
          title: `${j.jobItem} · ${j.assignee.split(" ")[0]}`,
          start: j.startDate!,
          end: addDay(j.endDate!),
          allDay: true,
          backgroundColor: c.bg,
          borderColor: c.border,
          textColor: c.text,
          extendedProps: { type: "job", job: j, status },
        };
      });

    const teamEvents: EventInput[] = showEvents
      ? events.map((e) => {
          const c = kindColor[e.kind];
          return {
            id: `ev-${e.id}`,
            title: e.title,
            start: e.start,
            end: addDay(e.end ?? e.start),
            allDay: true,
            backgroundColor: c.bg,
            borderColor: c.border,
            textColor: c.text,
            extendedProps: { type: "event", event: e },
          };
        })
      : [];

    return [...jobEvents, ...teamEvents];
  }, [jobs, events, model, pic, showClosed, showEvents]);

  function onEventClick(arg: EventClickArg) {
    const p = arg.event.extendedProps;
    if (p.type === "job") setSelected({ type: "job", job: p.job, status: p.status });
    else setSelected({ type: "event", event: p.event });
  }

  const selectClass =
    "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Model
          <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
            <option value={ALL}>Semua model</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          PIC
          <select value={pic} onChange={(e) => setPic(e.target.value)} className={selectClass}>
            <option value={ALL}>Semua PIC</option>
            {pics.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-4 w-4" />
          Tampilkan job selesai
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="h-4 w-4" />
          Rapat dan event
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        {(["Running", "Open", "Over", "Closed"] as JobStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <i className="h-3 w-3 rounded-sm border" style={{ background: statusColor[s].bg, borderColor: statusColor[s].border }} />
            Job {s}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-sm border" style={{ background: kindColor.meeting.bg, borderColor: kindColor.meeting.border }} />
          Rapat
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-sm border" style={{ background: kindColor.event.bg, borderColor: kindColor.event.border }} />
          Event
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={idLocale}
            firstDay={1}
            height="auto"
            events={calendarEvents}
            eventClick={onEventClick}
            dayMaxEvents={3}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,listMonth",
            }}
          />
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected && (
            <p className="text-sm text-slate-500">Klik sebuah job atau event di kalender untuk melihat detailnya.</p>
          )}

          {selected?.type === "job" && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-slate-500">{selected.job.model}</div>
                <h2 className="text-lg font-bold leading-snug">{selected.job.jobItem}</h2>
              </div>
              <StatusBadge status={selected.status} />
              <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-sm">
                <dt className="text-slate-500">Modul</dt>
                <dd>{selected.job.module}</dd>
                <dt className="text-slate-500">Stage</dt>
                <dd>{selected.job.stage}</dd>
                <dt className="text-slate-500">PIC</dt>
                <dd>{selected.job.assignee}</dd>
                <dt className="text-slate-500">Jadwal</dt>
                <dd>{selected.job.startDate} s/d {selected.job.endDate}</dd>
              </dl>
              <ProgressBar value={selected.job.progress} />
              {selected.job.detail && (
                <p className="whitespace-pre-line text-sm text-slate-700">{selected.job.detail}</p>
              )}
            </div>
          )}

          {selected?.type === "event" && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">{selected.event.title}</h2>
              <p className="text-sm text-slate-600">
                {selected.event.start}
                {selected.event.end ? ` s/d ${selected.event.end}` : ""}
              </p>
              <p className="text-xs capitalize text-slate-500">Jenis: {selected.event.kind}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}