"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSotRunAction,
  getSotStateAction,
  runPrefixAction,
  startSotRunAction,
  type SotActionResult,
} from "@/app/jobs/sot-sync-action";
import type { SotState } from "@/lib/sot-projects-repo";
import useDialogFocus from "@/components/ui/useDialogFocus";
import useDialogTransition from "@/components/ui/useDialogTransition";

const kindLabel = { projects: "Daftar project", leader: "Saring Team Leader", members: "Target model" } as const;

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const primary = "h-9 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50";

export default function SotSyncButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SotState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedLeaderFys, setSelectedLeaderFys] = useState<string[]>([]);
  const [notice, setNotice] = useState<SotActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [prefixPending, setPrefixPending] = useState(false);
  const wasRunning = useRef(false);

  const refresh = useCallback(async () => {
    const next = await getSotStateAction();
    setState(next);
    // Proses latar belakang baru selesai: muat ulang data halaman.
    if (wasRunning.current && !next.running) router.refresh();
    wasRunning.current = next.running;
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [open, refresh]);

  function act(task: () => Promise<SotActionResult>) {
    setNotice(null);
    startTransition(async () => {
      setNotice(await task());
      await refresh();
    });
  }

  async function buildPrefix() {
    setPrefixPending(true);
    setNotice(null);
    try {
      setNotice(await runPrefixAction());
      await refresh();
    } catch (error) {
      setNotice({
        ok: false,
        error: error instanceof Error ? error.message : "Gagal membangun prefix.",
      });
    } finally {
      setPrefixPending(false);
    }
  }

  const busy = pending || prefixPending || Boolean(state?.running);
  const { closing, requestClose } = useDialogTransition({ onClose: () => setOpen(false) });
  const dialogRef = useDialogFocus<HTMLDivElement>({ open, onClose: requestClose });
  const fys = state?.fys ?? [];
  const run = state?.run ?? null;
  const progress = state?.progress ?? { done: 0, total: 0, empty: 0, failed: 0 };
  const allSelected = fys.length > 0 && selected.length === fys.length;
  const allLeaderSelected = fys.length > 0 && selectedLeaderFys.length === fys.length;
  const progressPercent = progress.total
    ? Math.min(100, Math.round((progress.done / progress.total) * 100))
    : 0;

  function toggle(fy: string) {
    setSelected((cur) => (cur.includes(fy) ? cur.filter((x) => x !== fy) : [...cur, fy]));
  }

  function toggleLeader(fy: string) {
    setSelectedLeaderFys((cur) => (cur.includes(fy) ? cur.filter((x) => x !== fy) : [...cur, fy]));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setNotice(null);
        }}
        className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50"
      >
        Sinkron SOT
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={`${closing ? "drawer-overlay-out" : "drawer-overlay-in"} absolute inset-0 bg-slate-900/30`} onClick={() => !busy && requestClose()} aria-hidden="true" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sinkron project SOT"
            className={`${closing ? "drawer-out" : "drawer-in"} relative flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
          >
            <div>
              <h2 className="text-xl font-bold">Sinkron project SOT</h2>
              <p className="mt-1 text-sm text-slate-500">
                Jendela Edge akan terbuka di komputer server. Jika diminta login CompanyAccount, selesaikan di jendela itu.
              </p>
            </div>

            {notice?.error && (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                {notice.error}
              </p>
            )}
            {notice?.ok && notice.message && (
              <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {notice.message}
              </p>
            )}

            <Card title="1. Daftar project" desc="Membaca semua FY dan project dari satu halaman SOT. Menjalankan langkah ini mengaktifkan kembali semua project yang ditemukan.">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">{state ? `${state.totals.projects} project aktif` : "Memuat..."}</span>
                <button type="button" disabled={busy} onClick={() => act(() => startSotRunAction("projects"))} className={primary}>
                  Baca daftar project
                </button>
              </div>
            </Card>

            <Card
              title="1b. Saring Team Leader (opsional)"
              desc={state?.leaderConfigured ? "Project di FY yang dipilih tanpa issue Team Leader akan ditandai tidak aktif. FY lain tidak berubah." : "Fitur ini membutuhkan SOT_TEAM_LEADER_ID di .env.local."}
            >
              {state?.leaderConfigured ? (
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="h-4 w-4" checked={allLeaderSelected} onChange={() => setSelectedLeaderFys(allLeaderSelected ? [] : fys.map((f) => f.fy))} />
                    Pilih semua
                  </label>
                  <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                    {fys.map((f) => (
                      <li key={`leader-${f.fy}`}>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4" checked={selectedLeaderFys.includes(f.fy)} onChange={() => toggleLeader(f.fy)} />
                          <span className="font-medium">{f.fy}</span>
                          <span className="text-xs text-slate-500">{f.projects} project aktif</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <button type="button" disabled={busy || selectedLeaderFys.length === 0} onClick={() => act(() => startSotRunAction("leader", selectedLeaderFys))} className={primary}>
                      Saring FY terpilih ({selectedLeaderFys.length} FY)
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">FY lain tidak berubah. Jalankan ulang langkah 1 untuk mengaktifkan kembali semua project, lalu ulangi penyaringan ini.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Isi SOT_TEAM_LEADER_ID di .env.local untuk mengaktifkan penyaringan Team Leader.</p>
              )}
            </Card>

            <Card title="2. Target model" desc="Membuka halaman tiap project pada FY yang dipilih dan membaca target modelnya.">
              {fys.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada project. Jalankan langkah 1 dulu.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : fys.map((f) => f.fy))}
                    />
                    Pilih semua
                  </label>
                  <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                    {fys.map((f) => (
                      <li key={f.fy}>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4" checked={selected.includes(f.fy)} onChange={() => toggle(f.fy)} />
                          <span className="font-medium">{f.fy}</span>
                          <span className="text-xs text-slate-500">
                            {f.projects} project, {f.withMembers} sudah punya target model
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy || selected.length === 0}
                      onClick={() => act(() => startSotRunAction("members", selected))}
                      className={primary}
                    >
                      Ambil target model ({selected.length} FY)
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selected.length === 0
                      ? "Pilih minimal satu FY untuk mulai mengambil target model."
                      : `${selected.length} FY dipilih. Total ${fys.filter((item) => selected.includes(item.fy)).reduce((sum, item) => sum + item.projects, 0)} project akan diproses.`}
                  </p>
                </div>
              )}
            </Card>

            <Card
              title="3. Cocokkan model"
              desc="Menyamakan nama model dari SOT (mis. Linus2) dengan nama model di Monitoring Job (mis. Linus2-FAL) lewat kata depannya (prefix)."
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  {state ? `${state.prefix.total} prefix, ${state.totals.unmatched} model belum cocok` : "Memuat..."}
                </span>
                <button
                  type="button"
                  disabled={busy || !state || state.totals.projects === 0}
                  onClick={() => startTransition(() => void buildPrefix())}
                  aria-busy={prefixPending}
                  className={primary}
                >
                  {prefixPending ? "Sedang membangun..." : "Bangun prefix dan cocokkan"}
                </button>
              </div>
            </Card>

            {run && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">
                    {kindLabel[run.kind]}
                    {run.detail ? ` (${run.detail})` : ""} -{" "}
                    <span className={run.status === "failed" ? "text-red-700" : run.status === "success" ? "text-emerald-700" : "text-brand"}>
                      {run.status === "running" ? "berjalan" : run.status === "success" ? "selesai" : "gagal"}
                    </span>
                  </p>
                  {state?.running && (
                    <button
                      type="button"
                      onClick={() => act(cancelSotRunAction)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold hover:bg-slate-100"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
                {run.kind === "members" && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                      <span>
                        {state?.running ? "Sedang membaca target model..." : "Pembacaan target model"}
                      </span>
                      <span>
                        {progress.done}/{progress.total || "?"} project ({progressPercent}%)
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                    {!state?.running && progress.total > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        {progress.empty} project tidak memiliki field target model
                        {progress.failed > 0 ? `, ${progress.failed} project gagal dibaca.` : "."}
                      </p>
                    )}
                  </div>
                )}
                {run.status === "failed" && run.error && <p className="mt-2 text-sm text-red-800">{run.error}</p>}
                {run.status === "success" && (
                  <p className="mt-2 text-sm text-slate-600">
                    {run.kind === "members" ? `${run.projectCount} project, ${run.memberCount} target model` : `${run.projectCount} project`}
                  </p>
                )}
                <ul className="mt-2 max-h-36 overflow-y-auto font-mono text-[11px] leading-5 text-slate-600">
                  {state?.logs.map((l, i) => (
                    <li key={i} className={l.level === "error" ? "text-red-700" : l.level === "warn" ? "text-amber-700" : ""}>
                      {l.message}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={requestClose}
                disabled={busy}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold disabled:opacity-60"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
