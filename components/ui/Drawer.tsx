"use client";

import { createPortal } from "react-dom";
import useDialogFocus from "@/components/ui/useDialogFocus";
import useDialogTransition from "@/components/ui/useDialogTransition";

export const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900";
export const textareaClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900";

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

export function Drawer({
  open = true,
  onClose,
  label,
  size = "md",
  strip,
  children,
}: {
  open?: boolean;
  onClose: () => void;
  label: string;
  size: "md" | "lg";
  strip?: string;
  children: React.ReactNode;
}) {
  const { closing, requestClose } = useDialogTransition({ onClose });
  const dialogRef = useDialogFocus<HTMLElement>({ open, onClose: requestClose });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className={`${closing ? "drawer-overlay-out" : "drawer-overlay-in"} absolute inset-0 bg-slate-900/30`} onClick={requestClose} aria-hidden="true" />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`${closing ? "drawer-out" : "drawer-in"} absolute right-0 top-0 flex h-full w-full ${size === "lg" ? "max-w-xl" : "max-w-[440px]"} flex-col overflow-hidden bg-white shadow-2xl sm:right-3 sm:top-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl`}
      >
        {strip && <div className={`h-1.5 flex-none ${strip}`} />}
        {children}
      </aside>
    </div>,
    document.body,
  );
}

export function DrawerHeader({ eyebrow, title, onClose, children }: { eyebrow?: string; title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <header className="flex flex-none items-start justify-between gap-4 px-6 pb-5 pt-5">
      <div className="min-w-0">
        {eyebrow && <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{eyebrow}</span>}
        <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900">{title}</h2>
        {children}
      </div>
      <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-slate-200 text-lg text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand">
        ×
      </button>
    </header>
  );
}

export function DrawerBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto"><div className="flex flex-col gap-6 px-6 pb-6">{children}</div></div>;
}

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function DrawerFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <footer className={`flex flex-none gap-2 border-t border-slate-200 bg-white px-6 py-4 ${className}`}>{children}</footer>;
}

export default Drawer;
