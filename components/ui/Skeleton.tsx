export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="Memuat data">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-[38vh] rounded-2xl" />
    </div>
  );
}

export function IssueSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Memuat issue SOT">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-[48vh] rounded-2xl" />
    </div>
  );
}
