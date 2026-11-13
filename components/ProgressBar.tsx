"use client";

import type { CSSProperties } from "react";

export default function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="min-w-[120px]">
      <div className="h-1.5 rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill-in h-1.5 origin-left rounded-full bg-brand" style={{ "--progress": value } as CSSProperties} />
      </div>
      <div className="mt-1 tabular-nums text-xs text-slate-500">{pct}%</div>
    </div>
  );
}
