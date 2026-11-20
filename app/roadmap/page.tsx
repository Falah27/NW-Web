import { Suspense } from "react";
import { connection } from "next/server";
import RoadmapTimeline from "@/components/roadmap/RoadmapTimeline";
import { getRoadmapData } from "@/lib/roadmap-repo";
import { todayISO } from "@/lib/dates";

async function RoadmapContent() {
  await connection();
  const data = getRoadmapData();

  return (
    <RoadmapTimeline
      {...data}
      today={todayISO()}
      canEdit={process.env.ROADMAP_EDIT_ENABLED === "true"}
    />
  );
}

export default function RoadmapPage() {
  return (
    <div className="flex flex-col gap-5">
      <Suspense
        fallback={
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
            Memuat roadmap...
          </div>
        }
      >
        <RoadmapContent />
      </Suspense>
    </div>
  );
}
