"use client";

import { useMemo, useState } from "react";
import type { DocumentLink } from "@/lib/document-link";
import DocumentLinkDrawer from "@/components/documents/DocumentLinkDrawer";

function LinkActions({ link, onEdit, onDelete }: { link: DocumentLink; onEdit: () => void; onDelete: () => void }) {
  return <div className="absolute right-3 top-3 flex gap-1"><button type="button" aria-label={`Edit ${link.title}`} onClick={onEdit} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit</button><button type="button" aria-label={`Hapus ${link.title}`} onClick={onDelete} className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Hapus</button></div>;
}

export default function DocumentsClient({ links }: { links: DocumentLink[] }) {
  const [editing, setEditing] = useState<DocumentLink | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const categories = useMemo(() => [...new Set(links.map((item) => item.category))].sort((a, b) => a.localeCompare(b)), [links]);
  const primary = links.find((item) => item.isPrimary);
  const grouped = categories.map((category) => ({ category, links: links.filter((item) => item.category === category && item.id !== primary?.id) })).filter((group) => group.links.length > 0);

  function openNew() { setEditing(null); setDrawerOpen(true); }
  function openEdit(link: DocumentLink) { setEditing(link); setDrawerOpen(true); }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Dokumen</h1><p className="mt-1 text-sm text-slate-500">Pintasan ke SharePoint Network Team. Hak akses mengikuti SharePoint.</p></div>
        <button type="button" onClick={openNew} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90">+ Tambah pintasan</button>
      </div>
      {links.length === 0 ? (
        <section className="card mt-5 flex flex-col items-center gap-3 p-8 text-center"><h2 className="text-lg font-bold text-slate-900">Belum ada pintasan dokumen</h2><p className="text-sm text-slate-500">Tambahkan tautan SharePoint agar mudah ditemukan oleh tim.</p><button type="button" onClick={openNew} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90">+ Tambah pintasan</button></section>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {primary && <div className="relative rounded-2xl bg-brand p-5 pr-28 text-white shadow-sm"><a href={primary.url} target="_blank" rel="noopener noreferrer" className="block"><p className="text-xs font-semibold uppercase tracking-wide text-white/75">Pintasan utama</p><h2 className="mt-1 text-xl font-bold">{primary.title}</h2>{primary.description && <p className="mt-1 text-sm text-white/85">{primary.description}</p>}<span className="mt-4 inline-block text-sm font-semibold">Buka di SharePoint ↗</span></a><LinkActions link={primary} onEdit={() => openEdit(primary)} onDelete={() => openEdit(primary)} /></div>}
          {grouped.map(({ category, links: categoryLinks }) => <section key={category}><h2 className="mb-3 text-sm font-bold text-slate-900">{category}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categoryLinks.map((link) => <article key={link.id} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"><a href={link.url} target="_blank" rel="noopener noreferrer" className="block pr-16"><h3 className="font-bold text-slate-900">{link.title}</h3>{link.description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{link.description}</p>}<span className="mt-4 inline-block text-sm font-semibold text-brand">Buka ↗</span></a><LinkActions link={link} onEdit={() => openEdit(link)} onDelete={() => openEdit(link)} /></article>)}</div></section>)}
        </div>
      )}
      {drawerOpen && <DocumentLinkDrawer link={editing} categories={categories} onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
