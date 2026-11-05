"use client";

import { useState } from "react";
import JobFormDrawer from "@/components/jobs/JobFormDrawer";

export default function AddJobButton({
  members,
  models,
  modules,
  stages,
}: {
  members: string[];
  models: string[];
  modules: string[];
  stages: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90"
      >
        + Tambah Job
      </button>
      {open && (
        <JobFormDrawer
          job={null}
          members={members}
          models={models}
          modules={modules}
          stages={stages}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}