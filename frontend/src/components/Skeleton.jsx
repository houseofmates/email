export function Skeleton({ className }) {
  return <div className={`animate-pulse bg-pkm-500/50 rounded ${className}`} />;
}
export function InboxSkeleton() {
  return (
    <div className="divide-y divide-pkm-500">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="px-4 py-3 flex flex-col gap-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
