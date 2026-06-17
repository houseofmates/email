export function Skeleton({ className }) { return <div className={`animate-pulse bg-pkm-500/50 rounded ${className}`} />; }
export function InboxSkeleton() {
  return <div className="p-4 flex flex-col gap-4">
    <Skeleton className="h-4 w-1/4" /><Skeleton className="h-3 w-3/4" />
  </div>;
}
