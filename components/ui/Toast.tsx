"use client";

import { useEffect, useRef, useState } from "react";

export default function Toast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(4200);
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);
  const remainingRef = useRef(4200);

  useEffect(() => {
    if (paused || closing) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, remainingRef.current - 50);
      remainingRef.current = next;
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(timer);
        setClosing(true);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [paused, closing]);

  function dismiss() {
    setClosing(true);
  }

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onAnimationEnd={() => { if (closing) onDismiss(); }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      className={`glass ${closing ? "toast-out" : "toast-in"} fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl ${
        tone === "error"
          ? "border-red-200 bg-red-50/95 text-red-900"
          : "border-emerald-200 bg-emerald-50/95 text-emerald-900"
      }`}
    >
      <span className="mt-0.5 text-base" aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
      <span className="flex-1 leading-5">{message}</span>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left overflow-hidden rounded-full bg-current opacity-30">
        <span className="block h-full origin-left bg-current transition-transform duration-75" style={{ transform: `scaleX(${remaining / 4200})` }} />
      </span>
      <button type="button" onClick={dismiss} aria-label="Tutup notifikasi" className="-mr-1 rounded-md px-1 text-lg leading-5 opacity-60 transition hover:opacity-100">
        ×
      </button>
    </div>
  );
}
