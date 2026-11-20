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
  inputClass,
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
import styles from "./RoadmapTimeline.module.css";

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
  "--day-width"?: string;
  "--calendar-width"?: string;
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
  const dayWidthStyle: RoadmapStyle = { "--day-width": `${dayWidth}px` };
  const calendarWidth = dayCount * dayWidth;
  const todayOffset = diffDaysISO(start, today);

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
    <section className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">↻</span>
          <div>
            <h1>Roadmap Pengembangan Model</h1>
            <p>Jadwal dan milestone pengembangan</p>
          </div>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.periodControls} aria-label="Navigasi periode timeline">
            <button type="button" onClick={() => setDayWidth((width) => Math.max(MIN_DAY_WIDTH, width - 7))} aria-label="Perkecil timeline">
              −
            </button>
            <span className={styles.zoomLabel}>{Math.round((dayWidth / INITIAL_DAY_WIDTH) * 100)}%</span>
            <button type="button" onClick={() => setDayWidth((width) => Math.min(MAX_DAY_WIDTH, width + 7))} aria-label="Perbesar timeline">
              +
            </button>
            <span className={styles.controlDivider} />
            <button type="button" onClick={() => shiftPeriod(-1)} aria-label="Periode sebelumnya">‹</button>
            <button type="button" className={styles.todayButton} onClick={() => setStart(addDaysISO(today, -30))}>
              Hari ini
            </button>
            <button type="button" onClick={() => shiftPeriod(1)} aria-label="Periode berikutnya">›</button>
          </div>
          <label className={styles.srOnly} htmlFor="roadmap-period">Rentang timeline</label>
          <select
            id="roadmap-period"
            className={styles.periodSelect}
            value={dayCount}
            onChange={(event) => setDayCount(Number(event.target.value))}
          >
            <option value={45}>45 hari</option>
            <option value={90}>90 hari</option>
            <option value={180}>180 hari</option>
            <option value={365}>365 hari</option>
            <option value={730}>730 hari</option>
          </select>
          <label className={styles.srOnly} htmlFor="roadmap-search">Cari model atau milestone</label>
          <input
            id="roadmap-search"
            className={styles.search}
            type="search"
            placeholder="Cari model atau milestone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {canEdit && (
            <>
              <button type="button" className={styles.secondaryButton} onClick={() => setAddingModel(true)}>
                + Model
              </button>
              <button type="button" className={styles.primaryButton} onClick={openNewMilestone}>
                + Milestone
              </button>
            </>
          )}
        </div>
      </header>

      <div className={styles.summary}>
        <span>
          {dayDates[0]} — {dayDates[dayDates.length - 1]}
        </span>
        <span>{rows.length} model ditampilkan · {milestones.length} milestone total</span>
      </div>

      <div className={styles.legend} aria-label="Kategori milestone">
        {categories.map((category) => (
          <span key={category.id} className={styles.legendItem}>
            <i style={{ backgroundColor: category.color }} />
            {category.name}
          </span>
        ))}
        {!canEdit && <span className={styles.readOnly}>Mode hanya baca</span>}
      </div>

      <div className={styles.scrollArea}>
        <div
          className={styles.canvas}
          style={{
            ...dayWidthStyle,
            "--calendar-width": `${calendarWidth}px`,
            width: "calc(var(--model-width) + var(--calendar-width))",
          } as RoadmapStyle}
        >
          <div className={styles.header}>
            <div className={styles.corner}>
              <span className={styles.cornerIcon} aria-hidden="true">↻</span>
              <span>Model</span>
            </div>
            <div className={styles.calendarHeader} style={{ width: calendarWidth }}>
              <div className={styles.monthRow}>
                {monthSegments.map((segment) => (
                  <div
                    key={segment.startIso}
                    className={styles.monthCell}
                    style={{ width: segment.count * dayWidth }}
                  >
                    {segment.label}
                  </div>
                ))}
              </div>
              <div className={styles.dateRow}>
                {dayDates.map((date) => {
                  const parsed = parseISODate(date);
                  const weekend = parsed.getDay() === 0 || parsed.getDay() === 6;
                  return (
                    <div
                      key={date}
                      className={`${styles.dateCell} ${weekend ? styles.weekend : ""} ${date === today ? styles.todayDate : ""}`}
                      style={{ width: dayWidth }}
                      title={date}
                    >
                      {parsed.getDate()}
                    </div>
                  );
                })}
              </div>
              <div className={styles.dayNameRow}>
                {dayDates.map((date) => {
                  const parsed = parseISODate(date);
                  const weekend = parsed.getDay() === 0 || parsed.getDay() === 6;
                  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(parsed);
                  return (
                    <div
                      key={date}
                      className={`${styles.dayNameCell} ${weekend ? styles.weekend : ""}`}
                      style={{ width: dayWidth }}
                    >
                      {weekday}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {rows.map(({ model, layout, items }) => (
            <div className={styles.row} key={model.id} style={{ height: layout.rowHeight }}>
              <div className={styles.modelCell} title={model.name}>
                <span>{model.name}</span>
              </div>
              <div className={styles.calendarRow} style={{ width: calendarWidth }}>
                {monthSegments.map((segment, index) => (
                  <span
                    aria-hidden="true"
                    key={segment.startIso}
                    className={styles.monthDivider}
                    style={{
                      left: monthSegments
                        .slice(0, index)
                        .reduce((sum, previous) => sum + previous.count * dayWidth, 0),
                    }}
                  />
                ))}
                {todayOffset >= 0 && todayOffset < dayCount && (
                  <span
                    className={styles.todayLine}
                    style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                    aria-hidden="true"
                  />
                )}
                {items.map((item) => {
                  const milestone = milestoneById.get(item.id);
                  if (!milestone) return null;
                  const category = categoryById.get(milestone.categoryId);
                  const eventWidth = Math.max(22, item.spanDays * dayWidth - 6);
                  const tooltip = [
                    milestone.title,
                    model.name,
                    category?.name,
                    `${milestone.start} – ${milestone.end}`,
                    dueStatus(milestone.end, today),
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <button
                      type="button"
                      key={milestone.id}
                      className={styles.event}
                      style={{
                        left: item.offsetDays * dayWidth + 3,
                        width: eventWidth,
                        top: 5 + item.lane * LANE_HEIGHT,
                        backgroundColor: category?.color ?? "#cbd5e1",
                      }}
                      title={tooltip}
                      aria-label={tooltip}
                      aria-disabled={!canEdit}
                      onClick={() => canEdit && setEditing(milestone)}
                    >
                      {item.clippedLeft && <span className={styles.clipLeft} aria-hidden="true">‹</span>}
                      <span className={styles.eventTitle}>{milestone.title}</span>
                      {item.clippedRight && <span className={styles.clipRight} aria-hidden="true">›</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className={styles.emptyState}>
              {models.length === 0 ? "Belum ada model pada roadmap." : "Tidak ada model atau milestone yang cocok."}
            </div>
          )}
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
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Model
            <select className={inputClass} name="modelId" defaultValue={milestone.modelId} required>
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Kategori
            <select className={inputClass} name="categoryId" defaultValue={milestone.categoryId} required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Nama milestone
            <input className={inputClass} name="title" defaultValue={milestone.title} maxLength={120} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Tanggal mulai
              <input className={inputClass} type="date" name="start" defaultValue={milestone.start} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Tanggal selesai
              <input className={inputClass} type="date" name="end" defaultValue={milestone.end} required />
            </label>
          </div>
          <p className="text-xs text-slate-500">Durasi milestone maksimal 1096 hari.</p>
        </form>
      </DrawerBody>
      <DrawerFooter className="justify-between">
        {milestone.id !== undefined ? (
          <button type="button" onClick={onDelete} disabled={pending} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50">
            Hapus
          </button>
        ) : <span />}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">
            Batal
          </button>
          <button form="roadmap-milestone-form" type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
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
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Nama model
            <input className={inputClass} name="name" maxLength={80} required autoFocus />
          </label>
        </form>
      </DrawerBody>
      <DrawerFooter className="justify-end">
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">
          Batal
        </button>
        <button form="roadmap-model-form" type="submit" disabled={pending} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {pending ? "Menyimpan..." : "Tambah model"}
        </button>
      </DrawerFooter>
    </Drawer>
  );
}
