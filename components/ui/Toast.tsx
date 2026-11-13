"use client";

import { useEffect } from "react";

export default function Toast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`toast-in fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
        tone === "error"
          ? "border-red-200 bg-red-50/95 text-red-900"
          : "border-emerald-200 bg-emerald-50/95 text-emerald-900"
      }`}
    >
      <span className="mt-0.5 text-base" aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
      <span className="flex-1 leading-5">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Tutup notifikasi" className="-mr-1 rounded-md px-1 text-lg leading-5 opacity-60 transition hover:opacity-100">
        ×
      </button>
    </div>
  );
}
