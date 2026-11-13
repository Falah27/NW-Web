import EmptyState from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dokumen</h1>
      <section className="card"><EmptyState title="Dokumen belum tersedia" description="Ruang dokumen team sedang disiapkan. Coba kembali setelah fitur ini dirilis." /></section>
    </div>
  );
}
