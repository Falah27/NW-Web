"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearSotDataAction } from "@/app/sot-job/actions";

export default function ClearSotDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function clearData() {
    if (!window.confirm("Hapus semua project, target model, mapping, prefix, dan riwayat sinkronisasi SOT? Data job dan member tidak akan dihapus.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await clearSotDataAction();
      if (!result.ok) {
        setError(result.error ?? "Gagal menghapus data SOT.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={clearData}
        disabled={pending}
        className="h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Menghapus..." : "Hapus semua data SOT"}
      </button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
