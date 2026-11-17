"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { deleteDocumentLinkAction, saveDocumentLinkAction, type DocumentFormState } from "@/app/documents/actions";
import type { DocumentLink } from "@/lib/document-link";
import Drawer, { DrawerBody, DrawerFooter, DrawerHeader, FormField, inputClass, textareaClass } from "@/components/ui/Drawer";

const initialState: DocumentFormState = { ok: false };

export default function DocumentLinkDrawer({ link, categories, onClose }: { link: DocumentLink | null; categories: string[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(saveDocumentLinkAction, initialState);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  async function handleDelete() {
    if (!link) return;
    setDeleting(true);
    try {
      const result = await deleteDocumentLinkAction(link.id);
      if (result.ok) onClose();
    } finally {
      setDeleting(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <Drawer onClose={onClose} label={link ? "Edit pintasan" : "Tambah pintasan"} size="md">
      <DrawerHeader title={link ? "Edit pintasan" : "Tambah pintasan"} onClose={onClose} />
      <DrawerBody>
        <form id="document-link-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {link && <input type="hidden" name="id" value={link.id} />}
          <FormField label="Judul *"><input name="title" required maxLength={120} defaultValue={link?.title ?? ""} className={inputClass} /></FormField>
          <FormField label="Deskripsi"><textarea name="description" rows={4} maxLength={300} defaultValue={link?.description ?? ""} className={textareaClass} /></FormField>
          <FormField label="Kategori">
            <input name="category" list="document-categories" maxLength={40} defaultValue={link?.category ?? ""} className={inputClass} />
            <datalist id="document-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          </FormField>
          <FormField label="URL SharePoint *"><input name="url" type="url" required maxLength={2048} placeholder="https://contoh.test/..." defaultValue={link?.url ?? ""} className={inputClass} /></FormField>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" name="isPrimary" defaultChecked={link?.isPrimary ?? false} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" /> Jadikan pintasan utama</label>
          {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>}
        </form>
      </DrawerBody>
      {confirming ? (
        <DrawerFooter className="flex-col gap-3 border-red-200 bg-red-50">
          <p className="text-sm text-red-900">Hapus <b>{link?.title}</b>? Pintasan yang dihapus tidak bisa dikembalikan.</p>
          <div className="flex gap-2">
            <button type="button" disabled={deleting} onClick={handleDelete} className="h-10 flex-1 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deleting ? "Menghapus..." : "Ya, hapus pintasan"}</button>
            <button type="button" disabled={deleting} onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Batal</button>
          </div>
        </DrawerFooter>
      ) : (
        <DrawerFooter>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50">Batal</button>
          {link && <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50">Hapus</button>}
          <button form="document-link-form" type="submit" disabled={pending} className="h-10 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Menyimpan..." : "Simpan"}</button>
        </DrawerFooter>
      )}
    </Drawer>
  );
}
