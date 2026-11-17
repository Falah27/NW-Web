import { Suspense } from "react";
import { connection } from "next/server";
import DocumentsClient from "@/components/documents/DocumentsClient";
import { getDocumentLinks } from "@/lib/documents-repo";

async function DocumentsContent() {
  await connection();
  return <DocumentsClient links={getDocumentLinks()} />;
}

export default function Page() {
  return <div className="flex flex-col gap-5"><Suspense fallback={<p className="py-10 text-center text-slate-500">Memuat dokumen...</p>}><DocumentsContent /></Suspense></div>;
}
