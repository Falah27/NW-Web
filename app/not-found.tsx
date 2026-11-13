import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";

export default function NotFound() {
  return <main className="surface mx-auto flex min-h-[50vh] max-w-xl items-center justify-center rounded-2xl"><div><EmptyState title="Halaman tidak ditemukan" description="Alamat yang kamu buka tidak tersedia atau sudah dipindahkan." /><div className="-mt-6 flex justify-center"><Link href="/" className="h-9 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong">Kembali ke beranda</Link></div></div></main>;
}
