"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/jobs", label: "Monitoring Job" },
  { href: "/sot-job", label: "SOT Job" },
  { href: "/sot-issues", label: "SOT Issue" },
  { href: "/members", label: "Member" },
  { href: "/documents", label: "Dokumen" },
  { href: "/calendar", label: "Kalender" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <Link href="/jobs" className="shrink-0 text-xl font-bold tracking-tight text-slate-900">
        team<span className="ml-0.5 rounded-lg bg-brand px-2 text-white shadow-sm">hub</span>
      </Link>
      <nav className="glass flex max-w-[calc(100%-8rem)] gap-1 overflow-x-auto rounded-full bg-[#102535]/95 p-1.5 shadow-lg shadow-slate-900/15">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                active ? "bg-sky-500 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
