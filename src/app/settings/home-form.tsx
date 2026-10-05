/**
 * home-form.tsx — "Your home": name, location, units and time zone.
 * 📘 LEARN: Location and units change what Claude assumes (climate, season,
 * °C or °F); the time zone sets "Good morning" and dates.
 */
import { updateHomeAction } from "@/app/actions";
import type { HomeInfo } from "@/lib/types";

const field = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-leaf";

export function HomeForm({ name, home, saved, weatherPlace }: { name: string; home: HomeInfo; saved: boolean; weatherPlace: string | null }) {
  // Every time zone the server knows, e.g. "Africa/Johannesburg" (list built once per page load)
  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(home.timezone)) zones.unshift(home.timezone);

  return (
    <form action={updateHomeAction} className="mt-3 space-y-4">
      <label className="block text-sm font-semibold">
        Home name
        <input name="name" defaultValue={name} className={field} />
      </label>
      <label className="block text-sm font-semibold">
        Location <span className="font-normal text-muted">— city and country</span>
        <input name="location" defaultValue={home.location ?? ""} placeholder="e.g. Washington DC, USA" className={field} />
        {home.location && (
          <span className={`mt-1 block text-xs font-normal ${weatherPlace ? "text-muted" : "text-stressed"}`}>
            {weatherPlace
              ? `Weather for outdoor plants comes from: ${weatherPlace}`
              : "Couldn't find this place for weather yet. Try “City, Country”, e.g. “Cape Town, South Africa”."}
          </span>
        )}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Units
          <select name="units" defaultValue={home.units} className={field}>
            <option value="metric">°C and cm/m</option>
            <option value="imperial">°F and inches/feet</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Time zone
          <select name="timezone" defaultValue={home.timezone} className={field}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="rounded-lg bg-leaf px-4 py-2.5 font-semibold text-white">Save home</button>
      {saved && <p className="text-sm font-semibold text-healthy">Saved. New advice will use this location.</p>}
    </form>
  );
}
