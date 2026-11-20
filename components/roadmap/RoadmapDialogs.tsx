"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  createMilestoneAction,
  createModelAction,
  deleteMilestoneAction,
  deleteModelAction,
  saveCategoriesAction,
  updateMilestoneAction,
  renameModelAction,
} from "@/app/roadmap/actions";
import type { Milestone, MilestoneCategory, RoadmapModel } from "@/lib/types";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  dialogClass,
  dialogHeaderClass,
  inputClass,
  labelClass,
} from "./ui";

export type MilestoneDraft = Omit<Milestone, "id"> & { id?: number };

type NativeDialogProps = {
  open: boolean;
  labelledBy: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
};

function NativeDialog({
  open,
  labelledBy,
  className,
  onClose,
  children,
}: NativeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={`${dialogClass} ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}

function DialogCloseButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Tutup dialog"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-white/60 bg-white/10 text-xl text-white hover:bg-white/20 disabled:opacity-60"
    >
      ×
    </button>
  );
}

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Hapus",
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <NativeDialog
      open={open}
      labelledBy="roadmap-confirm-title"
      className="max-w-[430px]"
      onClose={onCancel}
    >
      <header className={dialogHeaderClass}>
        <h2 id="roadmap-confirm-title" className="pt-2 text-lg font-bold">{title}</h2>
        <DialogCloseButton onClick={onCancel} disabled={pending} />
      </header>
      <div className="flex gap-4 px-6 py-5">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-red-50 text-xl font-bold text-red-600">
          !
        </span>
        <p className="min-w-0 self-center text-sm leading-6 text-slate-600">{message}</p>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
          Batal
        </button>
        <button type="button" className={`${btnDanger} disabled:opacity-60`} onClick={onConfirm} disabled={pending}>
          {pending ? "Memproses..." : confirmText}
        </button>
      </footer>
    </NativeDialog>
  );
}

export function MilestoneDialog({
  models,
  categories,
  milestone,
  today,
  onClose,
  onSaved,
}: {
  models: RoadmapModel[];
  categories: MilestoneCategory[];
  milestone: MilestoneDraft;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [modelId, setModelId] = useState(milestone.modelId);
  const [categoryId, setCategoryId] = useState(milestone.categoryId);
  const [title, setTitle] = useState(milestone.title);
  const [start, setStart] = useState(milestone.start || today);
  const [end, setEnd] = useState(milestone.end || today);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = milestone.id !== undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const input = { modelId, categoryId, title, start, end };
    startTransition(async () => {
      const result = editing
        ? await updateMilestoneAction(milestone.id, input)
        : await createMilestoneAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onSaved(editing ? "Milestone berhasil diperbarui." : "Milestone berhasil ditambahkan.");
    });
  }

  function remove() {
    if (milestone.id === undefined) return;
    startTransition(async () => {
      const result = await deleteMilestoneAction(milestone.id);
      setConfirmOpen(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onSaved("Milestone berhasil dihapus.");
    });
  }

  function closeConfirm() {
    if (!pending) setConfirmOpen(false);
  }

  function closeDialog() {
    if (!pending && !confirmOpen) onClose();
  }

  return (
    <>
      <NativeDialog
        open
        labelledBy="roadmap-milestone-title"
        className="max-w-[560px]"
        onClose={closeDialog}
      >
        <header className={dialogHeaderClass}>
          <h2 id="roadmap-milestone-title" className="pt-2 text-lg font-bold">
            {editing ? "Ubah milestone" : "Tambah milestone"}
          </h2>
          <DialogCloseButton onClick={closeDialog} disabled={pending} />
        </header>
        <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-5">
          <InlineError message={error} />
          <label className={labelClass}>
            Model
            <select
              className={inputClass}
              value={modelId}
              onChange={(event) => setModelId(Number(event.target.value))}
              required
              disabled={pending}
            >
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Kategori
            <select
              className={inputClass}
              value={categoryId}
              onChange={(event) => setCategoryId(Number(event.target.value))}
              required
              disabled={pending}
            >
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Nama milestone
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
              disabled={pending}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Tanggal mulai
              <input
                className={inputClass}
                type="date"
                value={start}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStart(nextStart);
                  setEnd((currentEnd) => !currentEnd || currentEnd < nextStart ? nextStart : currentEnd);
                }}
                required
                disabled={pending}
              />
            </label>
            <label className={labelClass}>
              Tanggal selesai
              <input
                className={inputClass}
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
                disabled={pending}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">Durasi milestone maksimal 1096 hari.</p>
          <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            {editing ? (
              <button
                type="button"
                className={`${btnDanger} disabled:opacity-60`}
                onClick={() => setConfirmOpen(true)}
                disabled={pending}
              >
                Hapus
              </button>
            ) : <span />}
            <div className="ml-auto flex gap-2">
              <button type="button" className={btnSecondary} onClick={closeDialog} disabled={pending}>
                Batal
              </button>
              <button type="submit" className={`${btnPrimary} disabled:opacity-60`} disabled={pending}>
                {pending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </footer>
        </form>
      </NativeDialog>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus milestone?"
        message={`Milestone "${milestone.title}" akan dihapus permanen.`}
        pending={pending}
        onCancel={closeConfirm}
        onConfirm={remove}
      />
    </>
  );
}

export function ModelDialog({
  models,
  milestoneCount,
  model,
  onClose,
  onSaved,
}: {
  models: RoadmapModel[];
  milestoneCount: number;
  model?: RoadmapModel;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(model?.name ?? "");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = model !== undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const duplicate = models.some(
      (item) =>
        item.id !== model?.id &&
        item.name.toLocaleLowerCase("id-ID") === trimmedName.toLocaleLowerCase("id-ID")
    );
    if (duplicate) {
      setError("Nama model tersebut sudah digunakan.");
      return;
    }

    setError("");
    startTransition(async () => {
      const result = editing
        ? await renameModelAction(model.id, trimmedName)
        : await createModelAction(trimmedName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onSaved(editing ? "Nama model berhasil diperbarui." : "Model berhasil ditambahkan.");
    });
  }

  function remove() {
    if (!model) return;
    startTransition(async () => {
      const result = await deleteModelAction(model.id);
      setConfirmOpen(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onSaved(`Model berhasil dihapus beserta ${milestoneCount} milestone.`);
    });
  }

  function closeConfirm() {
    if (!pending) setConfirmOpen(false);
  }

  function closeDialog() {
    if (!pending && !confirmOpen) onClose();
  }

  return (
    <>
      <NativeDialog
        open
        labelledBy="roadmap-model-title"
        className="max-w-[440px]"
        onClose={closeDialog}
      >
        <header className={dialogHeaderClass}>
          <div>
            <h2 id="roadmap-model-title" className="text-lg font-bold">
              {editing ? "Ubah model" : "Tambah model"}
            </h2>
            <p className="mt-1 text-xs text-blue-100">
              {editing ? "Perbarui nama model di roadmap." : "Tambahkan model ke roadmap."}
            </p>
          </div>
          <DialogCloseButton onClick={closeDialog} disabled={pending} />
        </header>
        <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-5">
          <InlineError message={error} />
          <label className={labelClass}>
            Nama model
            <input
              className={inputClass}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              maxLength={80}
              autoComplete="off"
              required
              disabled={pending}
              autoFocus
            />
          </label>
          {editing && (
            <p className="text-xs text-slate-500">
              {milestoneCount} milestone akan ikut terhapus jika model ini dihapus.
            </p>
          )}
          <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            {editing ? (
              <button
                type="button"
                className={`${btnDanger} disabled:opacity-60`}
                onClick={() => setConfirmOpen(true)}
                disabled={pending}
              >
                Hapus model
              </button>
            ) : <span />}
            <div className="ml-auto flex gap-2">
              <button type="button" className={btnSecondary} onClick={closeDialog} disabled={pending}>
                Batal
              </button>
              <button type="submit" className={`${btnPrimary} disabled:opacity-60`} disabled={pending}>
                {pending ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah model"}
              </button>
            </div>
          </footer>
        </form>
      </NativeDialog>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus model?"
        message={`Model "${model?.name ?? ""}" dan ${milestoneCount} milestone yang terkait akan dihapus permanen.`}
        pending={pending}
        onCancel={closeConfirm}
        onConfirm={remove}
      />
    </>
  );
}

type CategoryDraft = {
  key: string;
  id?: number;
  name: string;
  color: string;
};

function categoryDuplicates(drafts: CategoryDraft[]): Set<string> {
  const duplicates = new Set<string>();
  for (let index = 0; index < drafts.length; index += 1) {
    const category = drafts[index];
    for (let otherIndex = index + 1; otherIndex < drafts.length; otherIndex += 1) {
      const other = drafts[otherIndex];
      if (category.name.trim().toLocaleLowerCase("id-ID") === other.name.trim().toLocaleLowerCase("id-ID")) {
        duplicates.add(category.key);
        duplicates.add(other.key);
      }
      if (category.color.toLowerCase() === other.color.toLowerCase()) {
        duplicates.add(category.key);
        duplicates.add(other.key);
      }
    }
  }
  return duplicates;
}

export function CategoryManager({
  categories,
  milestones,
  canEdit,
  onClose,
  onSaved,
}: {
  categories: MilestoneCategory[];
  milestones: Milestone[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState<CategoryDraft[]>(() =>
    categories.map((category) => ({ ...category, key: `category-${category.id}` }))
  );
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#63d5da");
  const [error, setError] = useState("");
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(0);
  const duplicates = useMemo(() => categoryDuplicates(drafts), [drafts]);
  const originalById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const dirty = useMemo(() => {
    if (drafts.length !== categories.length) return true;
    return drafts.some((draft, index) => {
      const original = categories[index];
      return (
        !original ||
        draft.id !== original.id ||
        draft.name.trim() !== original.name ||
        draft.color.toLowerCase() !== original.color.toLowerCase()
      );
    });
  }, [categories, drafts]);
  const pendingDelete = drafts.find((category) => category.key === deleteKey) ?? null;

  function updateDraft(key: string, field: "name" | "color", value: string) {
    setDrafts((current) =>
      current.map((category) => category.key === key ? { ...category, [field]: value } : category)
    );
    setError("");
  }

  function addDraft() {
    const name = newName.trim();
    if (!name || name.length > 40) {
      setError("Nama kategori wajib diisi dan maksimal 40 karakter.");
      return;
    }
    if (drafts.some((category) => category.name.trim().toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"))) {
      setError("Nama kategori tidak boleh kembar.");
      return;
    }
    if (drafts.some((category) => category.color.toLowerCase() === newColor.toLowerCase())) {
      setError("Warna kategori tidak boleh kembar.");
      return;
    }
    setDrafts((current) => [
      ...current,
      { key: `new-${nextKey.current++}`, name, color: newColor },
    ]);
    setNewName("");
    setError("");
  }

  function save() {
    if (!canEdit || duplicates.size > 0) {
      setError(duplicates.size > 0 ? "Nama dan warna kategori harus unik." : "");
      return;
    }
    setError("");
    const input = drafts.map(({ id, name, color }) => ({
      ...(id === undefined ? {} : { id }),
      name: name.trim(),
      color,
    }));
    startTransition(async () => {
      const result = await saveCategoriesAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      onSaved("Kategori berhasil disimpan.");
    });
  }

  function removeDraft() {
    if (!pendingDelete) return;
    setDrafts((current) => current.filter((category) => category.key !== pendingDelete.key));
    setDeleteKey(null);
    setError("");
  }

  function closeConfirm() {
    if (!pending) setDeleteKey(null);
  }

  function closeDialog() {
    if (!pending && !deleteKey) onClose();
  }

  return (
    <>
      <NativeDialog
        open
        labelledBy="roadmap-category-title"
        className="max-w-[720px]"
        onClose={closeDialog}
      >
        <header className={dialogHeaderClass}>
          <h2 id="roadmap-category-title" className="pt-2 text-lg font-bold">Kategori milestone</h2>
          <DialogCloseButton onClick={closeDialog} disabled={pending} />
        </header>
        <div className="flex flex-col gap-4 px-6 py-5">
          <InlineError message={error} />
          {canEdit && (
            <div className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto]">
              <label className={labelClass}>
                Nama kategori baru
                <input
                  className={inputClass}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={40}
                  placeholder="Contoh: Certification"
                  disabled={pending}
                />
              </label>
              <label className={labelClass}>
                Warna
                <input
                  className="h-10 w-16 rounded-lg border border-slate-300 bg-white p-1"
                  type="color"
                  value={newColor}
                  onChange={(event) => setNewColor(event.target.value)}
                  disabled={pending}
                />
              </label>
              <button type="button" className={btnSecondary} onClick={addDraft} disabled={pending}>
                + Tambah kategori
              </button>
            </div>
          )}
          <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
            {drafts.map((category) => {
              const usedCount = category.id === undefined
                ? 0
                : milestones.filter((milestone) => milestone.categoryId === category.id).length;
              const original = category.id === undefined ? undefined : originalById.get(category.id);
              const rowDirty =
                !original ||
                category.name.trim() !== original.name ||
                category.color.toLowerCase() !== original.color.toLowerCase();
              const duplicate = duplicates.has(category.key);

              return (
                <div
                  key={category.key}
                  className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-2 ${
                    rowDirty ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white"
                  }`}
                >
                  {canEdit ? (
                    <input
                      aria-label={`Warna kategori ${category.name}`}
                      className="h-10 w-[52px] rounded-lg border border-slate-300 bg-white p-1"
                      type="color"
                      value={category.color}
                      onChange={(event) => updateDraft(category.key, "color", event.target.value)}
                      disabled={pending}
                    />
                  ) : (
                    <span
                      className="h-7 w-7 rounded-sm border border-slate-300"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    {canEdit ? (
                      <input
                        aria-label={`Nama kategori ${category.name}`}
                        className={`${inputClass} w-full`}
                        value={category.name}
                        onChange={(event) => updateDraft(category.key, "name", event.target.value)}
                        maxLength={40}
                        disabled={pending}
                      />
                    ) : (
                      <p className="truncate text-sm font-semibold text-slate-800">{category.name}</p>
                    )}
                    {duplicate && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        Nama atau warna kategori sudah dipakai.
                      </p>
                    )}
                    {usedCount > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Dipakai oleh {usedCount} milestone; kategori ini tidak dapat dihapus.
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Hapus kategori ${category.name}`}
                      className="h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setDeleteKey(category.key)}
                      disabled={pending || usedCount > 0 || drafts.length <= 1}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {canEdit ? (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <span className={`inline-flex items-center gap-2 text-xs ${dirty ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                <i className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-500" : "bg-slate-400"}`} />
                {dirty ? "Ada perubahan belum disimpan" : "Tidak ada perubahan"}
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" className={btnSecondary} onClick={closeDialog} disabled={pending}>
                  Tutup
                </button>
                <button
                  type="button"
                  className={`${btnPrimary} disabled:opacity-50`}
                  onClick={save}
                  disabled={pending || !dirty || duplicates.size > 0}
                >
                  {pending ? "Menyimpan..." : "Simpan semua"}
                </button>
              </div>
            </footer>
          ) : (
            <footer className="flex justify-end border-t border-slate-200 pt-4">
              <button type="button" className={btnSecondary} onClick={closeDialog}>
                Tutup
              </button>
            </footer>
          )}
        </div>
      </NativeDialog>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Hapus kategori?"
        message={`Kategori "${pendingDelete?.name ?? ""}" akan dihapus setelah perubahan disimpan.`}
        confirmText="Hapus"
        onCancel={closeConfirm}
        onConfirm={removeDraft}
      />
    </>
  );
}
