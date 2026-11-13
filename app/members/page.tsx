import { Suspense } from "react";
import { connection } from "next/server";
import MemberCard from "@/components/members/MemberCard";
import { getJobs, getMembers } from "@/lib/jobs-repo";
import { computeStatus } from "@/lib/status";
import CountUp from "@/components/ui/CountUp";

async function MembersContent() {
  await connection();
  const jobs = getJobs();
  const members = getMembers();

  const isActive = (j: (typeof jobs)[number]) => !j.archived && computeStatus(j) !== "Closed";
  const activeByPerson = (name: string) =>
    jobs.filter((j) => j.assignee === name && isActive(j)).length;

  const stats = [
    { label: "Member", value: members.length },
    { label: "Job aktif", value: jobs.filter(isActive).length },
    { label: "Model ditangani", value: new Set(jobs.map((j) => j.model)).size },
  ];

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s, index) => (
          <div key={s.label} style={{ "--i": index } as React.CSSProperties} className="card card-stagger p-5">
            <div className="text-sm font-medium text-slate-500">{s.label}</div>
            <div className="mt-1 text-4xl font-bold tracking-tight"><CountUp value={s.value} /></div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Anggota team</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} activeJobs={activeByPerson(m.name)} />
          ))}
        </div>
      </section>
    </>
  );
}

export default function MembersPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="card relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-soft" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-3xl bg-slate-100" />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <span className="w-fit rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            Kenalan dengan team
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Orang-orang di balik team kami
          </h1>
          <p className="text-lg text-slate-600">
            Team yang bekerja bersama untuk menyelesaikan pekerjaan dengan rapi dan terukur.
          </p>
        </div>
      </section>

      <Suspense fallback={<p className="py-10 text-center text-slate-500">Memuat data member...</p>}>
        <MembersContent />
      </Suspense>
    </div>
  );
}
