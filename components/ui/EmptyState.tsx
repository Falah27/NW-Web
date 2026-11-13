type EmptyStateProps = {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25z" />
          <path d="M8 9h8M8 12h8M8 15h5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      </div>
      {action && <button type="button" onClick={action.onClick} className="h-9 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-strong">{action.label}</button>}
    </div>
  );
}
