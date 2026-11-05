import type { Member } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function MemberCard({
  member,
  activeJobs,
}: {
  member: Member;
  activeJobs: number;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-soft text-xl font-bold text-brand">
          {initials(member.name)}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-snug">{member.name}</h3>
          <p className="text-sm text-slate-500">{member.role}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {member.skills.map((s) => (
          <span
            key={s}
            className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
        <span className="text-slate-500">
          Job aktif: <b className="text-slate-900">{activeJobs}</b>
        </span>
        <a
          href={member.email ? `mailto:${member.email}` : "#"}
          className="font-semibold text-brand hover:underline"
        >
          Hubungi
        </a>
      </div>
    </article>
  );
}