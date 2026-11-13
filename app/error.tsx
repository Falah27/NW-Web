"use client";

import EmptyState from "@/components/ui/EmptyState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="surface mx-auto flex min-h-[50vh] max-w-xl items-center justify-center rounded-2xl"><EmptyState title="Terjadi kendala" description="Data belum dapat dimuat. Coba ulangi beberapa saat lagi." action={{ label: "Coba lagi", onClick: reset }} /></main>;
}
