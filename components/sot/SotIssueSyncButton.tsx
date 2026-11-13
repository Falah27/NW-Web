"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { syncSotIssuesAction } from "@/app/sot-issues/actions";
import Toast from "@/components/ui/Toast";

export default function SotIssueSyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const sync = useCallback(() => {
    setNotice(null);
    startTransition(async () => {
      const result = await syncSotIssuesAction();
      setNotice(result.ok ? { ok: true, text: result.message ?? "Selesai." } : { ok: false, text: result.error ?? "Gagal." });
      if (result.ok) router.refresh();
    });
  }, [router, startTransition]);

  useEffect(() => {
    const openSync = () => { if (!pending && !disabled) sync(); };
    window.addEventListener("open-sot-issue-sync", openSync);
    return () => window.removeEventListener("open-sot-issue-sync", openSync);
  }, [disabled, pending, sync]);

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
      {notice && <Toast key={notice.text} message={notice.text} tone={notice.ok ? "success" : "error"} onDismiss={dismissNotice} />}
    </div>
  );
}
