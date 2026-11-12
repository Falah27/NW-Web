"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncSotIssuesAction } from "@/app/sot-issues/actions";

export default function SotIssueSyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function sync() {
    setNotice(null);
    startTransition(async () => {
      const result = await syncSotIssuesAction();
      setNotice(result.ok ? { ok: true, text: result.message ?? "Selesai." } : { ok: false, text: result.error ?? "Gagal." });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={pending || disabled}
        className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Membaca dari SOT..." : "Sinkron issue SOT"}
      </button>
      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`max-w-md text-right text-xs ${notice.ok ? "text-emerald-700" : "text-red-700"}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
}
