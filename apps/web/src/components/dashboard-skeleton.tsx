/**
 * Instant placeholder shown by the dashboard `loading.tsx` files while a page's
 * code and data load, so a sidebar click responds immediately instead of
 * freezing on the previous page. Server component, no data, no JS.
 */
const block = "bg-slate-200/70 dark:bg-white/5 animate-pulse";

export function DashboardSkeleton() {
  return (
    <div
      className="p-4 md:p-8 lg:p-10 space-y-8 max-w-[1800px] mx-auto"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="space-y-3">
        <div className={`${block} h-9 w-64 rounded-2xl`} />
        <div className={`${block} h-4 w-96 max-w-full rounded-xl`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 p-6 space-y-3"
          >
            <div className={`${block} h-3 w-24 rounded-lg`} />
            <div className={`${block} h-7 w-16 rounded-xl`} />
          </div>
        ))}
      </div>

      <div className="rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className={`${block} h-10 w-10 rounded-full shrink-0`} />
            <div className="flex-1 space-y-2">
              <div className={`${block} h-3 w-1/3 rounded-lg`} />
              <div className={`${block} h-3 w-2/3 rounded-lg`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
