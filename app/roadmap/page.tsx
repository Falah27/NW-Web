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
          <div className="py-10 text-center text-slate-500">
            Memuat roadmap...
          </div>
        }
      >
        <RoadmapContent />
      </Suspense>
    </div>
  );
}
