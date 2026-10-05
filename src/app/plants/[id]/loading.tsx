/**
 * loading.tsx — shown the instant you tap a plant, while its page is fetched.
 *
 * 📘 LEARN: Next.js shows this file automatically during navigation, then swaps
 * in the real page when it's ready. It's a "skeleton": grey shapes where the
 * photo and text will be, gently pulsing, so the tap feels answered right away.
 */
export default function PlantLoading() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading plant">
      <span className="inline-block pt-1 text-sm text-muted">← All plants</span>
      <div className="animate-pulse">
        <div className="aspect-[4/3] rounded-[10px] bg-tint sm:aspect-[16/9]" />
        <div className="mt-4 h-8 w-40 rounded-md bg-tint" />
        <div className="mt-3 h-4 w-64 max-w-full rounded bg-tint" />
        <div className="mt-5 space-y-2">
          <div className="h-3.5 w-full rounded bg-tint" />
          <div className="h-3.5 w-5/6 rounded bg-tint" />
        </div>
        <div className="mt-7 h-32 rounded-[10px] bg-tint" />
      </div>
    </div>
  );
}
