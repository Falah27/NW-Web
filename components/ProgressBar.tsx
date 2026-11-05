export default function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="min-w-[120px]">
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">{pct}%</div>
    </div>
  );
}