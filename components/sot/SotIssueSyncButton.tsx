"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { syncSotIssuesAction } from "@/app/sot-issues/actions";
import Toast from "@/components/ui/Toast";

export default function SotIssueSyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const dismissNotice = useCallback(() => setNotice(null), []);

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
      {notice && <Toast message={notice.text} tone={notice.ok ? "success" : "error"} onDismiss={dismissNotice} />}
    </div>
  );
}
