/**
 * page.tsx (home) — what needs doing today, then all plants at a glance.
 *
 * 📘 LEARN: This is a *Server Component*: it runs on the server, reads the
 * store directly, and sends finished HTML to the phone. No loading spinners,
 * no API calls from the browser.
 */
import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { store } from "@/lib/store";
import { StatusLine, formatDue } from "@/components/ui";
import type { HealthStatus } from "@/lib/types";
import { isOutdoor } from "@/lib/environment";
import { getHomeWeather } from "@/lib/home-weather";
import { weatherAlerts } from "@/lib/weather";

/** "Good morning" in the home's own time zone (Dubai, Washington, Cape Town…). */
function greeting(timeZone: string, d = new Date()) {
  let h: number;
  try {
    h = Number(d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone }));
  } catch {
    h = d.getUTCHours();
  }
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const ORDER: Record<HealthStatus, number> = { critical: 0, stressed: 1, watch: 2, healthy: 3 };

export default async function Home() {
  await connection(); // always read fresh data, never a build-time snapshot
  const [bundles, viewer] = await Promise.all([store.listPlants(), store.getViewer()]);

  const counts: Record<HealthStatus, number> = { healthy: 0, watch: 0, stressed: 0, critical: 0 };
  for (const b of bundles) if (b.latest) counts[b.latest.status]++;
  const needCare = counts.stressed + counts.critical;

  const due = bundles
    .flatMap((b) => b.checks.filter((c) => !c.doneAt).map((c) => ({ ...c, plant: b.plant })))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .slice(0, 5);

  // 📘 Weather alerts only matter if there are outdoor plants — otherwise we
  // don't even ask the weather service.
  const outdoor = bundles.filter((b) => isOutdoor(b.plant.current)).map((b) => b.plant);
  const weather = outdoor.length ? await getHomeWeather(viewer.home) : null;
  const alerts = weather ? weatherAlerts(weather.data, viewer.home.units) : [];

  // Plants that need the most attention first
  const sorted = [...bundles].sort((a, b) => (ORDER[a.latest?.status ?? "healthy"] ?? 4) - (ORDER[b.latest?.status ?? "healthy"] ?? 4));

  return (
    <div>
      <h1 className="mt-3 text-[34px] leading-[1.05] tracking-[-0.03em]">{greeting(viewer.home.timezone)}, {viewer.name}</h1>
      <p className="mt-2.5 text-[15px] text-muted">
        {needCare > 0 ? (
          <>
            <b className="font-semibold text-ink">
              {needCare} {needCare === 1 ? "plant needs" : "plants need"} care
            </b>{" "}
            today.{" "}
          </>
        ) : (
          <b className="font-semibold text-ink">All plants are doing fine. </b>
        )}
        {counts.watch} to watch, {counts.healthy} healthy.
      </p>

      {alerts.length > 0 && (
        <div className={`mt-5 rounded-[10px] p-4 ${alerts.some((a) => a.kind === "frost" || a.kind === "heat") ? "bg-stressed-soft" : "bg-watch-soft"}`}>
          <p className="text-[15px] font-semibold">{alerts.map((a) => a.text).join(" · ")}</p>
          <p className="mt-1 text-sm">
            Check your outdoor plants:{" "}
            {outdoor.map((pl, i) => (
              <span key={pl.id}>
                {i > 0 && ", "}
                <Link href={`/plants/${pl.id}`} className="font-semibold underline">
                  {pl.nickname}
                </Link>
                {pl.current.movable === "yes" ? " (can move)" : pl.current.movable === "no" ? " (protect in place)" : ""}
              </span>
            ))}
            . Open one and tap Update advice for what to do.
          </p>
        </div>
      )}

      {due.length > 0 && (
        <>
          <h2 className="mb-1.5 mt-8 text-[19px]">Today</h2>
          <ul>
            {due.map((c) => {
              const d = formatDue(c.dueOn);
              return (
                <li key={c.id} className="border-b border-line">
                  <Link href={`/plants/${c.plant.id}`} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 py-3">
                    <span className="relative size-11 overflow-hidden rounded-lg bg-tint">
                      {c.plant.photoUrl && (
                        <Image src={c.plant.photoUrl} alt="" fill sizes="44px" className="object-cover" unoptimized={c.plant.photoUrl.startsWith("/api/")} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{c.plant.nickname}</span>
                      <span className="block text-sm text-muted">{c.task}</span>
                    </span>
                    <span className={`text-right text-[13px] font-semibold ${d.tone}`}>{d.text}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="mb-3 mt-9 text-[19px]">Your plants</h2>
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-3">
        {sorted.map(({ plant, latest }, i) => (
          <Link key={plant.id} href={`/plants/${plant.id}`} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-tint">
              {plant.photoUrl && (
                <Image
                  src={plant.photoUrl}
                  alt={plant.nickname}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  loading={i < 2 ? "eager" : "lazy"}
                  className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  unoptimized={plant.photoUrl.startsWith("/api/")}
                />
              )}
            </div>
            <div className="mt-2.5 text-base font-bold tracking-tight">{plant.nickname}</div>
            <div className="truncate text-[13px] text-muted">{plant.commonName}</div>
            <StatusLine status={latest?.status} className="mt-1.5" />
          </Link>
        ))}
      </div>

      <Link
        href="/plants/new"
        className="mt-8 flex h-[52px] items-center justify-center rounded-lg bg-leaf text-base font-semibold text-white hover:bg-leaf/90"
      >
        Add a plant
      </Link>
    </div>
  );
}
