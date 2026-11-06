"use client";

import { useMemo, useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import idLocale from "@fullcalendar/core/locales/id";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { EventKind, Job, JobStatus, TeamEvent } from "@/lib/types";
import { computeStatus } from "@/lib/status";
import EventFormDrawer from "@/components/calendar/EventFormDrawer";
import CalendarDetailDrawer, { type Selected } from "@/components/calendar/CalendarDetailDrawer";
import { deleteEventAction } from "@/app/calendar/actions";

const ALL = "all";
type Palette = { bg: string; border: string; text: string };

const statusColor: Record<JobStatus, Palette> = {
  Running: { bg: "#e8f0fe", border: "#2b4acb", text: "#1e3a8a" },
  Open: { bg: "#f1f5f9", border: "#64748b", text: "#334155" },
  Over: { bg: "#fdecec", border: "#dc2626", text: "#7f1d1d" },
  Closed: { bg: "#e6f4ec", border: "#16a34a", text: "#14532d" },
  "-": { bg: "#ffffff", border: "#94a3b8", text: "#475569" },
};

const kindColor: Record<EventKind, Palette> = {
  meeting: { bg: "#fff4e0", border: "#d97706", text: "#78350f" },
  event: { bg: "#f3e8ff", border: "#9333ea", text: "#581c87" },
  holiday: { bg: "#fee2e2", border: "#b91c1c", text: "#7f1d1d" },
};

type Mode = "due" | "range";
const STATUSES = ["Running", "Open", "Over", "Closed"] as const;
type ShownStatus = (typeof STATUSES)[number];
const KINDS: { key: EventKind; label: string }[] = [
  { key: "meeting", label: "Rapat" },
  { key: "event", label: "Event" },
  { key: "holiday", label: "Libur" },
];

function addDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function effectiveStatus(job: Job): JobStatus {
  return job.archived ? "Closed" : computeStatus(job);
}

function Chip({
  active,
  palette,
  count,
  onClick,
  children,
}: {
  active: boolean;
  palette: Palette;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={active ? { background: palette.bg, borderColor: palette.border, color: palette.text } : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
        active ? "" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
      }`}
    >
      <i
        className="h-2.5 w-2.5 rounded-full border"
        style={{
          background: active ? palette.border : "transparent",
          borderColor: active ? palette.border : "#cbd5e1",
        }}
      />
      {children}
      {count !== undefined && <span className="font-medium opacity-70">{count}</span>}
    </button>
  );
}

export default function JobCalendar({ jobs, events }: { jobs: Job[]; events: TeamEvent[] }) {
  const [mode, setMode] = useState<Mode>("due");
  const [model, setModel] = useState(ALL);
  const [pic, setPic] = useState(ALL);
  const [statusOn, setStatusOn] = useState<Record<ShownStatus, boolean>>({
    Running: true,
    Open: true,
    Over: true,
    Closed: false,
  });
  const [kindOn, setKindOn] = useState<Record<EventKind, boolean>>({
    meeting: true,
    event: true,
    holiday: true,
  });
  const [selected, setSelected] = useState<Selected>(null);
  const [eventForm, setEventForm] = useState<{ date?: string } | null>(null);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const models = Array.from(new Set(jobs.map((job) => job.model))).sort();
  const pics = Array.from(new Set(jobs.map((job) => job.assignee).filter(Boolean))).sort();

  const scheduled = useMemo(
    () =>
      jobs
        .filter((job) => job.startDate && job.endDate)
        .filter((job) => model === ALL || job.model === model)
        .filter((job) => pic === ALL || job.assignee === pic),
    [jobs, model, pic]
  );

  const counts = useMemo(() => {
    const result: Record<ShownStatus, number> = { Running: 0, Open: 0, Over: 0, Closed: 0 };
    for (const job of scheduled) {
      const status = effectiveStatus(job);
      if (status !== "-") result[status] += 1;
    }
    return result;
  }, [scheduled]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    const jobEvents: EventInput[] = scheduled
      .filter((job) => {
        const status = effectiveStatus(job);
        return status === "-" || statusOn[status];
      })
      .map((job) => {
        const status = effectiveStatus(job);
        const palette = statusColor[status];
        return {
          id: `job-${job.id}`,
          title: job.jobItem,
          ...(mode === "range"
            ? { start: job.startDate!, end: addDay(job.endDate!) }
            : { start: job.endDate! }),
          allDay: true,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          textColor: palette.text,
          extendedProps: {
            type: "job",
            job,
            status,
            who: initials(job.assignee),
            tooltip: `${job.jobItem}\n${job.model} · ${job.assignee || "Tanpa PIC"}\n${job.startDate} s/d ${job.endDate}`,
          },
        };
      });

    const agendaEvents: EventInput[] = events
      .filter((event) => kindOn[event.kind])
      .map((event) => {
        const palette = kindColor[event.kind];
        return {
          id: `ev-${event.id}`,
          title: event.title,
          start: event.start,
          end: addDay(event.end ?? event.start),
          allDay: true,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          textColor: palette.text,
          extendedProps: { type: "event", event, tooltip: event.title },
        };
      });

    return [...agendaEvents, ...jobEvents];
  }, [scheduled, events, statusOn, kindOn, mode]);

  function handleDeleteEvent(event: TeamEvent) {
    if (!window.confirm(`Hapus event "${event.title}"?`)) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteEventAction(event.id);
      if (result.ok) setSelected(null);
      else setDeleteError(result.error ?? "Gagal menghapus event.");
    });
  }

  function onEventClick(arg: EventClickArg) {
    const props = arg.event.extendedProps;
    setDeleteError(null);
    if (props.type === "job") setSelected({ type: "job", job: props.job, status: props.status });
    else setSelected({ type: "event", event: props.event });
  }

  const selectClass = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filter model" value={model} onChange={(event) => setModel(event.target.value)} className={selectClass}>
            <option value={ALL}>Semua model</option>
            {models.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Filter PIC" value={pic} onChange={(event) => setPic(event.target.value)} className={selectClass}>
            <option value={ALL}>Semua PIC</option>
            {pics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <div role="group" aria-label="Mode tampilan job" className="inline-flex rounded-lg border border-slate-300 p-0.5">
            {([{ key: "due", label: "Tenggat" }, { key: "range", label: "Rentang" }] as { key: Mode; label: string }[]).map((item) => (
              <button key={item.key} type="button" aria-pressed={mode === item.key} onClick={() => setMode(item.key)} className={`h-8 rounded-md px-3 text-sm font-semibold transition ${mode === item.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setEventForm({})} className="ml-auto h-9 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90">
            + Tambah event
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Job</span>
          {STATUSES.map((status) => <Chip key={status} active={statusOn[status]} palette={statusColor[status]} count={counts[status]} onClick={() => setStatusOn((prev) => ({ ...prev, [status]: !prev[status] }))}>{status}</Chip>)}
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-500">Agenda</span>
          {KINDS.map((kind) => <Chip key={kind.key} active={kindOn[kind.key]} palette={kindColor[kind.key]} onClick={() => setKindOn((prev) => ({ ...prev, [kind.key]: !prev[kind.key] }))}>{kind.label}</Chip>)}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWorkWeek"
          locale={idLocale}
          firstDay={1}
          height="auto"
          fixedWeekCount={false}
          events={calendarEvents}
          eventClick={onEventClick}
          dateClick={(arg) => setEventForm({ date: arg.dateStr })}
          dayMaxEvents={3}
          moreLinkClick="popover"
          moreLinkContent={(arg) => `+${arg.num} lagi`}
          views={{
            timeGridWorkWeek: {
              type: "timeGrid",
              duration: { days: 5 },
              dateAlignment: "week",
              hiddenDays: [0, 6],
            },
          }}
          buttonText={{
            today: "Hari ini",
            day: "Day",
            week: "Week",
            month: "Month",
            timeGridWorkWeek: "Work Week",
          }}
          eventDidMount={(info) => { info.el.title = info.event.extendedProps.tooltip ?? info.event.title; }}
          eventContent={(arg) => {
            const props = arg.event.extendedProps;
            return <div className="flex min-w-0 items-center gap-1"><span className="truncate">{arg.event.title}</span>{props.type === "job" && props.who && <span className="ml-auto flex-none rounded bg-white/70 px-1 text-[10px] font-bold">{props.who}</span>}</div>;
          }}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWorkWeek,timeGridWeek,dayGridMonth",
          }}
        />
      </div>

      <p className="text-xs text-slate-500">
        {mode === "due" ? "Job tampil di tanggal End Date-nya. Pilih Rentang untuk melihat Start sampai End Date." : "Job tampil sebagai bar dari Start sampai End Date."}{" "}
        Klik tanggal kosong untuk menambah event, klik job atau event untuk detail.
      </p>

      <CalendarDetailDrawer selected={selected} onClose={() => setSelected(null)} onDeleteEvent={handleDeleteEvent} deleting={deleting} deleteError={deleteError} />
      {eventForm && <EventFormDrawer defaultDate={eventForm.date} onClose={() => setEventForm(null)} />}
    </div>
  );
}
