/**
 * loading.tsx — the default "one moment" screen for any page without its own.
 * (Plant pages have a more detailed one in plants/[id]/loading.tsx.)
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 pt-3" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 rounded-md bg-tint" />
      <div className="h-4 w-72 max-w-full rounded bg-tint" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-square rounded-[10px] bg-tint" />
        ))}
      </div>
    </div>
  );
}
