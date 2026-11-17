"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = links.find((link) => pathname.startsWith(link.href)) ?? links[0];

  useEffect(() => {
    const update = () => {
      const nav = navRef.current;
      const active = activeRef.current;
      if (!nav || !active) return;
      setIndicator({ x: active.offsetLeft, width: active.offsetWidth });
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (observer && navRef.current) observer.observe(navRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="relative mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <Link href="/jobs" className="shrink-0 text-xl font-bold tracking-tight text-slate-900">
        team<span className="ml-0.5 rounded-lg bg-brand px-2 text-white shadow-sm">hub</span>
      </Link>
      <div className="relative sm:hidden">
        <button
          type="button"
          aria-label="Buka menu halaman"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          className="flex min-w-[9.5rem] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
        >
          <span className="min-w-0 truncate text-xs font-semibold">
            <span className="text-slate-400">Menu / </span>
            <span className="text-slate-900">{current.label}</span>
          </span>
          <span className={`text-slate-500 transition-transform ${mobileOpen ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
        </button>
        {mobileOpen && (
          <nav aria-label="Menu halaman" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      <nav ref={navRef} aria-label="Menu halaman" className="navbar-shell glass relative hidden max-w-[calc(100%-8rem)] gap-1 overflow-x-auto rounded-full p-1.5 shadow-lg shadow-slate-900/15 sm:flex">
        <span aria-hidden="true" className="navbar-active-pill absolute inset-y-1 left-1 rounded-full bg-sky-500 shadow-sm" style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }} />
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              className={`relative z-10 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                active ? "text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
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
