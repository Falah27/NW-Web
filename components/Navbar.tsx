"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/jobs", label: "Monitoring Job" },
  { href: "/members", label: "Member" },
  { href: "/documents", label: "Dokumen" },
  { href: "/calendar", label: "Kalender" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
      <Link href="/jobs" className="text-xl font-bold tracking-tight">
        team<span className="ml-0.5 rounded-md bg-brand px-2 text-white">hub</span>
      </Link>
      <nav className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-1">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
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