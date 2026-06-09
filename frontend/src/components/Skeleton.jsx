// skeleton loaders — solid pkm-700 blocks with an opacity pulse (see index.css
// .animate-pulse-soft). shapes mirror the real content so there's no layout
// shift when data arrives. prefer these over spinners for loads >1s.

export function SkeletonBlock({ className = "" }) {
  return <div className={`rounded bg-pkm-700 animate-pulse-soft ${className}`} aria-hidden="true" />
}

// a single list row: title line + subtitle line, matching the passwords /
// aliases list layout.
export function SkeletonRow() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-1/3" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        <SkeletonBlock className="h-7 w-14" />
      </div>
    </div>
  )
}

// a vertical list of rows (passwords / aliases / mail list loading state).
export function SkeletonList({ rows = 6 }) {
  return (
    <div className="divide-y divide-pkm-500" role="status" aria-label="loading">
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
      <span className="sr-only">loading…</span>
    </div>
  )
}

// a card in a grid (vault item cards).
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3 space-y-2">
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-3 w-1/2" />
    </div>
  )
}

export function SkeletonCardGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="loading">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
      <span className="sr-only">loading…</span>
    </div>
  )
}

export default SkeletonList
