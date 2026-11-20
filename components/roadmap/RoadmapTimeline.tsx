"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import {
  createMilestoneAction,
  createModelAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/app/roadmap/actions";
import Drawer, {
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/Drawer";
import Toast from "@/components/ui/Toast";
import { addDaysISO, diffDaysISO, parseISODate } from "@/lib/dates";
import {
  dueStatus,
  getMonthSegments,
  layoutRow,
  LANE_HEIGHT,
} from "@/lib/roadmap-layout";
import type { Milestone, MilestoneCategory, RoadmapModel } from "@/lib/types";
import { readableTextColor } from "./colors";
import styles from "./roadmap.module.css";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "./ui";

const INITIAL_DAY_WIDTH = 42;
const MIN_DAY_WIDTH = 14;
const MAX_DAY_WIDTH = 70;

type Props = {
  models: RoadmapModel[];
  categories: MilestoneCategory[];
  milestones: Milestone[];
  today: string;
  canEdit: boolean;
};

type FormMilestone = Omit<Milestone, "id"> & { id?: number };
type ToastMessage = { message: string; tone: "success" | "error"; key: number };
type RoadmapStyle = CSSProperties & {
  "--model-width"?: string;
  "--day-width"?: string;
  "--calendar-width"?: string;
  "--weekend-offset"?: string;
  "--today-position"?: string;
};

function milestoneFromForm(form: FormData): FormMilestone {
  return {
    modelId: Number(form.get("modelId")),
    categoryId: Number(form.get("categoryId")),
    title: String(form.get("title") ?? ""),
    start: String(form.get("start") ?? ""),
    end: String(form.get("end") ?? ""),
  };
}

export default function RoadmapTimeline({
  models,
  categories,
  milestones,
  today,
  canEdit,
}: Props) {
  const [dayCount, setDayCount] = useState(180);
  const [dayWidth, setDayWidth] = useState(INITIAL_DAY_WIDTH);
  const [start, setStart] = useState(() => addDaysISO(today, -30));
  const [search, setSearch] = useState("");
  const [showCategories, setShowCategories] = useState(true);
  const [editing, setEditing] = useState<FormMilestone | null>(null);
  const [addingModel, setAddingModel] = useState(false);
  const [notice, setNotice] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  const dayDates = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => addDaysISO(start, index)),
    [dayCount, start]
  );
  const monthSegments = useMemo(
    () => getMonthSegments(start, dayCount),
    [dayCount, start]
  );
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    const byModel = new Map<number, Milestone[]>();
    for (const milestone of milestones) {
      const current = byModel.get(milestone.modelId) ?? [];
      current.push(milestone);
      byModel.set(milestone.modelId, current);
    }

    return models
      .map((model) => {
        const modelMilestones = byModel.get(model.id) ?? [];
        const modelMatches = !query || model.name.toLocaleLowerCase("id-ID").includes(query);
        const matches = new Set(
          modelMilestones
            .filter(
              (milestone) =>
                modelMatches || milestone.title.toLocaleLowerCase("id-ID").includes(query)
            )
            .map((milestone) => milestone.id)
        );
        const layout = layoutRow(modelMilestones, start, dayCount);

        return {
          model,
          layout,
          milestones: modelMilestones,
          items: layout.items.filter((item) => modelMatches || matches.has(item.id)),
          visible: modelMatches || matches.size > 0,
        };
      })
      .filter((row) => row.visible);
  }, [dayCount, milestones, models, search, start]);

  const milestoneById = useMemo(
    () => new Map(milestones.map((milestone) => [milestone.id, milestone])),
    [milestones]
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const calendarWidth = dayCount * dayWidth;
  const todayOffset = diffDaysISO(start, today);
  const dayWidthStyle: RoadmapStyle = {
    "--day-width": `${dayWidth}px`,
    "--weekend-offset": `${((parseISODate(start).getDay() + 6) % 7) * dayWidth}px`,
    "--today-position":
      todayOffset >= 0 && todayOffset < dayCount
        ? `${todayOffset * dayWidth}px`
        : "-10000px",
  };

  function showNotice(message: string, tone: ToastMessage["tone"] = "success") {
    setNotice({ message, tone, key: Date.now() });
  }

  function openNewMilestone() {
    if (models.length === 0 || categories.length === 0) {
      showNotice("Tambahkan model dan kategori sebelum membuat milestone.", "error");
      return;
    }
    setEditing({
      modelId: models[0].id,
      categoryId: categories[0].id,
      title: "",
      start: today,
      end: today,
    });
  }

  function shiftPeriod(direction: -1 | 1) {
    setStart((current) => addDaysISO(current, direction * dayCount));
  }

  function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = milestoneFromForm(formData);
    const id = editing?.id;
    startTransition(async () => {
      const result =
        id === undefined
          ? await createMilestoneAction(input)
          : await updateMilestoneAction(id, input);
      if (!result.ok) {
        showNotice(result.error, "error");
        return;
      }
      setEditing(null);
      showNotice(id === undefined ? "Milestone berhasil ditambahkan." : "Milestone berhasil diperbarui.");
    });
  }

  function removeMilestone() {
    if (editing?.id === undefined) return;
    if (!window.confirm("Hapus milestone ini? Tindakan ini tidak dapat dibatalkan.")) return;
    const id = editing.id;
    startTransition(async () => {
      const result = await deleteMilestoneAction(id);
      if (!result.ok) {
        showNotice(result.error, "error");
        return;
      }
      setEditing(null);
      showNotice("Milestone berhasil dihapus.");
    });
  }

  function submitModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    startTransition(async () => {
      const result = await createModelAction(name);
      if (!result.ok) {
        showNotice(result.error, "error");
        return;
      }
      setAddingModel(false);
      showNotice("Model berhasil ditambahkan.");
    });
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Roadmap Model</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dayDates[0]} — {dayDates[dayDates.length - 1]} · {rows.length} model ditampilkan · {milestones.length} milestone
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className={`${labelClass} min-w-[220px] flex-1`}>
          Cari model atau milestone
          <input
            id="roadmap-search"
            className={`${inputClass} w-full`}
            type="search"
            placeholder="Cari model atau milestone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Periode
          <select
            id="roadmap-period"
            className={inputClass}
            value={dayCount}
            onChange={(event) => setDayCount(Number(event.target.value))}
          >
            <option value={45}>45 hari</option>
            <option value={90}>90 hari</option>
            <option value={180}>180 hari</option>
            <option value={365}>365 hari</option>
            <option value={730}>730 hari</option>
          </select>
        </label>
        <div role="group" aria-label="Zoom timeline" className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => setDayWidth((width) => Math.max(MIN_DAY_WIDTH, width - 7))}
            aria-label="Perkecil timeline"
            className="h-10 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            −
          </button>
          <span className="inline-flex h-10 min-w-14 items-center justify-center border-l border-slate-300 px-3 text-sm font-semibold text-slate-700">
            {Math.round((dayWidth / INITIAL_DAY_WIDTH) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setDayWidth((width) => Math.min(MAX_DAY_WIDTH, width + 7))}
            aria-label="Perbesar timeline"
            className="h-10 border-l border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            +
          </button>
        </div>
        <div role="group" aria-label="Navigasi periode" className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          <button type="button" onClick={() => shiftPeriod(-1)} aria-label="Periode sebelumnya" className="h-10 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            ‹
          </button>
          <button type="button" onClick={() => setStart(addDaysISO(today, -30))} className="h-10 border-l border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Hari ini
          </button>
          <button type="button" onClick={() => shiftPeriod(1)} aria-label="Periode berikutnya" className="h-10 border-l border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            ›
          </button>
        </div>
        {canEdit && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCategories((visible) => !visible)}
              aria-expanded={showCategories}
              aria-controls="roadmap-category-legend"
              className={btnSecondary}
            >
              Kategori
            </button>
            <button type="button" className={btnPrimary} onClick={openNewMilestone}>
              + Tambah milestone
            </button>
          </div>
        )}
      </div>

      {showCategories && (
        <div id="roadmap-category-legend" aria-label="Kategori milestone" className="flex flex-wrap gap-4 text-xs text-slate-600">
          {categories.map((category) => (
            <span key={category.id} className="inline-flex items-center gap-2">
              <i
                className="h-3 w-3 rounded-sm border border-slate-300"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-[calc(100vh-18rem)] min-h-[480px] max-w-full overflow-auto overscroll-contain">
        <div
          className="relative"
          style={{
            ...dayWidthStyle,
            "--model-width": "180px",
            "--calendar-width": `${calendarWidth}px`,
            width: "calc(var(--model-width) + var(--calendar-width))",
          } as RoadmapStyle}
        >
          <div className="sticky top-0 z-20 flex h-20 bg-white">
            <div className="sticky left-0 z-30 flex h-20 w-[180px] flex-none items-center justify-center gap-2 border-r border-slate-200 bg-slate-100">
              <span className="text-xs font-semibold text-slate-500">Model</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setAddingModel(true)}
                  aria-label="Tambah model"
                  title="Tambah model"
                  className="h-7 w-7 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  +
                </button>
              )}
            </div>
            <div className="flex-none" style={{ width: calendarWidth }}>
              <div className="flex h-9 border-b border-slate-200">
                {monthSegments.map((segment, index) => (
                  <div
                    key={segment.startIso}
                    className={`flex h-9 flex-none items-center justify-center border-b border-slate-200 text-sm font-bold text-slate-900 ${index > 0 ? "border-l border-slate-300" : ""}`}
                    style={{ width: segment.count * dayWidth }}
                  >
                    {segment.label}
                  </div>
                ))}
              </div>
              <div className="flex h-11">
                {dayDates.map((date) => {
                  const parsed = parseISODate(date);
                  const weekend = parsed.getDay() === 0 || parsed.getDay() === 6;
                  const sunday = parsed.getDay() === 0;
                  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(parsed);
                  const isToday = date === today;
                  return (
                    <div
                      key={date}
                      className={`flex h-11 flex-none flex-col items-center justify-center border-b border-r border-slate-200 ${weekend ? "bg-slate-50" : "bg-white"}`}
                      style={{ width: dayWidth }}
                      title={date}
                    >
                      <span className={`text-[10px] font-semibold ${sunday ? "text-red-500" : "text-slate-400"}`}>
                        {weekday}
                      </span>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-brand text-white" : "text-slate-700"}`}>
                        {parsed.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {todayOffset >= 0 && todayOffset < dayCount && (
            <span
              className="pointer-events-none absolute bottom-0 top-20 z-[4] w-0.5 bg-[#2b4acb] before:absolute before:-top-px before:left-[-3px] before:h-2 before:w-2 before:rounded-full before:bg-[#2b4acb]"
              style={{ left: 180 + todayOffset * dayWidth + dayWidth / 2 }}
              aria-hidden="true"
            />
          )}

          {rows.map(({ model, layout, items, milestones: modelMilestones }) => (
            <div className="flex border-b border-slate-100" key={model.id} style={{ height: layout.rowHeight }}>
              <div
                tabIndex={0}
                aria-describedby={`roadmap-model-tooltip-${model.id}`}
                className="group sticky left-0 z-10 flex w-[180px] flex-none items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand hover:z-30 hover:bg-brand-soft hover:text-brand"
              >
                <span className="truncate">{model.name}</span>
                <div
                  id={`roadmap-model-tooltip-${model.id}`}
                  role="tooltip"
                  className="pointer-events-none invisible absolute left-2 top-[calc(100%+0.375rem)] z-[60] w-[280px] whitespace-normal rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
                >
                  <p className="border-b border-slate-100 pb-2 font-bold text-slate-900">{model.name}</p>
                  <p className="py-2 text-slate-500">{modelMilestones.length} milestone</p>
                  {modelMilestones.length > 0 ? (
                    <ul className="space-y-1">
                      {modelMilestones.slice(0, 5).map((milestone) => (
                        <li key={milestone.id} className="truncate">{milestone.title}</li>
                      ))}
                    </ul>
                  ) : <p className="text-slate-500">Belum ada milestone.</p>}
                  {modelMilestones.length > 5 && (
                    <p className="mt-1 text-slate-500">dan {modelMilestones.length - 5} lainnya</p>
                  )}
                </div>
              </div>
              <div
                className={`${styles.calendarRow} relative min-h-[34px] flex-none`}
                style={{ width: calendarWidth }}
              >
                {monthSegments.slice(1).map((segment) => (
                  <span
                    aria-hidden="true"
                    key={segment.startIso}
                    className="absolute inset-y-0 z-[1] border-l border-slate-300"
                    style={{ left: diffDaysISO(start, segment.startIso) * dayWidth }}
                  />
                ))}
                {items.map((item) => {
                  const milestone = milestoneById.get(item.id);
                  if (!milestone) return null;
                  const category = categoryById.get(milestone.categoryId);
                  const categoryColor = category?.color ?? "#cbd5e1";
                  const eventWidth = Math.max(22, item.spanDays * dayWidth - 6);
                  const due = dueStatus(milestone.end, today);
                  const dueColor = due.startsWith("Terlambat")
                    ? "text-red-600"
                    : due === "Jatuh tempo hari ini"
                      ? "text-brand"
                      : "text-slate-500";
                  const tooltip = [
                    milestone.title,
                    model.name,
                    category?.name,
                    `${milestone.start} – ${milestone.end}`,
                    due,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <button
                      type="button"
                      key={milestone.id}
                      className="group absolute z-[3] flex h-[22px] min-w-[22px] items-center gap-1 overflow-visible rounded-md border px-1.5 text-xs font-semibold text-left hover:z-40 hover:brightness-[0.97] hover:shadow-sm focus-visible:z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
                      style={{
                        left: item.offsetDays * dayWidth + 3,
                        width: eventWidth,
                        top: 5 + item.lane * LANE_HEIGHT,
                        backgroundColor: categoryColor,
                        borderColor: `color-mix(in srgb, ${categoryColor} 65%, #0f172a)`,
                        borderLeftWidth: 3,
                        color: readableTextColor(categoryColor),
                      }}
                      aria-label={tooltip}
                      aria-describedby={`roadmap-milestone-tooltip-${milestone.id}`}
                      aria-disabled={!canEdit}
                      onClick={() => canEdit && setEditing(milestone)}
                    >
                      {item.clippedLeft && <span className="flex-none font-bold" aria-hidden="true">‹</span>}
                      <span className="min-w-0 truncate">{milestone.title}</span>
                      {item.clippedRight && <span className="flex-none font-bold" aria-hidden="true">›</span>}
                      <span
                        id={`roadmap-milestone-tooltip-${milestone.id}`}
                        role="tooltip"
                        className="pointer-events-none invisible absolute left-2 top-full z-[60] mt-2 w-max max-w-80 whitespace-normal rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
                      >
                        <strong className="mb-2 block border-b border-slate-100 pb-2 font-bold text-slate-900">
                          {milestone.title}
                        </strong>
                        <span className="block">{model.name}{category ? ` · ${category.name}` : ""}</span>
                        <span className="mt-1 block">{milestone.start} – {milestone.end}</span>
                        <span className={`mt-1 block ${dueColor}`}>{due}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="py-10 text-center text-slate-500">
              {models.length === 0 ? "Belum ada model pada roadmap." : "Tidak ada model atau milestone yang cocok."}
            </div>
          )}
        </div>
      </div>
      </div>

      {editing && canEdit && (
        <MilestoneDrawer
          categories={categories}
          models={models}
          milestone={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onDelete={removeMilestone}
          onSubmit={submitMilestone}
        />
      )}
      {addingModel && canEdit && (
        <ModelDrawer
          pending={pending}
          onClose={() => setAddingModel(false)}
          onSubmit={submitModel}
        />
      )}
      {notice && (
        <Toast
          key={notice.key}
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      )}
    </section>
  );
}

function MilestoneDrawer({
  categories,
  models,
  milestone,
  pending,
  onClose,
  onDelete,
  onSubmit,
}: {
  categories: MilestoneCategory[];
  models: RoadmapModel[];
  milestone: FormMilestone;
  pending: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Drawer onClose={onClose} label="Form milestone roadmap" size="md">
      <DrawerHeader
        title={milestone.id === undefined ? "Tambah milestone" : "Ubah milestone"}
        onClose={onClose}
      />
      <DrawerBody>
        <form id="roadmap-milestone-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className={labelClass}>
            Model
            <select className={inputClass} name="modelId" defaultValue={milestone.modelId} required>
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Kategori
            <select className={inputClass} name="categoryId" defaultValue={milestone.categoryId} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Nama milestone
            <input className={inputClass} name="title" defaultValue={milestone.title} maxLength={120} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Tanggal mulai
              <input className={inputClass} type="date" name="start" defaultValue={milestone.start} required />
            </label>
            <label className={labelClass}>
              Tanggal selesai
              <input className={inputClass} type="date" name="end" defaultValue={milestone.end} required />
            </label>
          </div>
          <p className="text-xs text-slate-500">Durasi milestone maksimal 1096 hari.</p>
        </form>
      </DrawerBody>
      <DrawerFooter className="justify-between">
        {milestone.id !== undefined ? (
          <button type="button" onClick={onDelete} disabled={pending} className={`${btnDanger} disabled:opacity-60`}>
            Hapus
          </button>
        ) : <span />}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Batal
          </button>
          <button form="roadmap-milestone-form" type="submit" disabled={pending} className={`${btnPrimary} disabled:opacity-60`}>
            {pending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </DrawerFooter>
    </Drawer>
  );
}

function ModelDrawer({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Drawer onClose={onClose} label="Form model roadmap" size="md">
      <DrawerHeader title="Tambah model" onClose={onClose} />
      <DrawerBody>
        <form id="roadmap-model-form" onSubmit={onSubmit}>
          <label className={labelClass}>
            Nama model
            <input className={inputClass} name="name" maxLength={80} required autoFocus />
          </label>
        </form>
      </DrawerBody>
      <DrawerFooter className="justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Batal
        </button>
        <button form="roadmap-model-form" type="submit" disabled={pending} className={`${btnPrimary} disabled:opacity-60`}>
          {pending ? "Menyimpan..." : "Tambah model"}
        </button>
      </DrawerFooter>
    </Drawer>
  );
}
