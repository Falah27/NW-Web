export default function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="filter-chip-in inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand/40 hover:bg-brand/15"
    >
      {label}
      <span aria-hidden="true" className="text-sm leading-none opacity-70">×</span>
    </button>
  );
}
