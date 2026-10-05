/**
 * weather.ts — local weather for outdoor plants, from Open-Meteo.
 *
 * 📘 LEARN: Open-Meteo is free for non-commercial use and needs no account or
 * API key. We ask for the past 7 days (did it rain?) and the next 7 (frost?
 * heatwave?), always in metric, and convert for display. Results are cached
 * for an hour (`next: { revalidate }`), so opening ten plant pages makes one
 * weather request, not ten. If the weather service is down, everything still
 * works — the weather section is simply left out.
 */
import type { Units } from "@/lib/types";

export type DayWeather = { date: string; min: number; max: number; rain: number; rainChance: number | null; wind: number }; // °C, mm, km/h
export type WeatherData = { today: string; past: DayWeather[]; next: DayWeather[] };
export type WeatherAlert = { kind: "frost" | "heat" | "wind" | "rain"; date: string; text: string };
export type Place = { latitude: number; longitude: number; place: string; timezone?: string };

const TIMEOUT_MS = 4000;

async function getJson(url: string, revalidate: number) {
  const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Weather service ${res.status}`);
  return res.json();
}

// ── Where is "Cape Town, South Africa"? ─────────────────────────────────────

type GeoResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string; population?: number };

/**
 * Turns the home's location text into a map position. Tries the full text
 * first ("Paris, France" works), then just the city, and picks the most
 * populated match — so "Washington DC, USA" finds Washington, D.C.
 */
export async function geocode(location: string): Promise<Place | null> {
  const full = location.trim();
  if (full.length < 2) return null;
  const city = full.split(",")[0].trim();
  const cityNoCode = city.replace(/\s+[A-Z]{2,3}$/, "").trim(); // "Washington DC" → "Washington"
  // Common short forms people type, so "Washington DC, USA" prefers the US match.
  const ALIASES: Record<string, string> = { usa: "united states", us: "united states", uk: "united kingdom", uae: "united arab emirates", sa: "south africa", rsa: "south africa" };
  const hints = full
    .split(",")
    .slice(1)
    .map((p) => ALIASES[p.trim().toLowerCase().replace(/\./g, "")] ?? p.trim().toLowerCase())
    .filter((h) => h.length > 1);
  for (const name of [...new Set([full, city, cityNoCode])]) {
    if (name.length < 2) continue;
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`;
      const data = (await getJson(url, 60 * 60 * 24 * 30)) as { results?: GeoResult[] };
      let results = data.results ?? [];
      if (!results.length) continue;
      // If they told us the country/region, prefer matches from it.
      if (hints.length) {
        const inHint = results.filter((r) =>
          hints.some((h) => [r.country, r.admin1].some((x) => x && (x.toLowerCase() === h || x.toLowerCase().startsWith(h) || (h.length > 3 && x.toLowerCase().includes(h))))),
        );
        if (inHint.length) results = inHint;
      }
      const best = results.reduce((a, b) => ((b.population ?? 0) > (a.population ?? 0) ? b : a));
      return {
        latitude: best.latitude,
        longitude: best.longitude,
        place: [best.name, best.admin1, best.country].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", "),
        timezone: best.timezone,
      };
    } catch {
      return null; // service unreachable — try again next time
    }
  }
  return null;
}

// ── Past 7 + next 7 days ─────────────────────────────────────────────────────

type Forecast = {
  utc_offset_seconds: number;
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
};

export async function getWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  // Rounded to ~1 km so nearby requests share the cache.
  const lat = latitude.toFixed(2);
  const lon = longitude.toFixed(2);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&past_days=7&forecast_days=7&timezone=auto`;
  try {
    return parseForecast((await getJson(url, 60 * 60)) as Forecast);
  } catch {
    return null;
  }
}

/** Splits Open-Meteo's daily arrays into the past week and today-onwards (exported for tests). */
export function parseForecast(f: Forecast, now: Date = new Date()): WeatherData {
  const today = new Date(now.getTime() + f.utc_offset_seconds * 1000).toISOString().slice(0, 10);
  const d = f.daily;
  const days: DayWeather[] = d.time.map((date, i) => ({
    date,
    min: d.temperature_2m_min[i] ?? NaN,
    max: d.temperature_2m_max[i] ?? NaN,
    rain: d.precipitation_sum[i] ?? 0,
    rainChance: d.precipitation_probability_max?.[i] ?? null,
    wind: d.wind_speed_10m_max[i] ?? 0,
  }));
  const ok = (x: DayWeather) => Number.isFinite(x.min) && Number.isFinite(x.max);
  return { today, past: days.filter((x) => x.date < today && ok(x)), next: days.filter((x) => x.date >= today && ok(x)) };
}

// ── Units and wording ────────────────────────────────────────────────────────

export const fmtTemp = (c: number, u: Units) => (u === "imperial" ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`);
export const fmtRain = (mm: number, u: Units) =>
  u === "imperial" ? `${(mm / 25.4).toFixed(mm > 0 && mm < 2.54 ? 2 : 1).replace(/\.?0+$/, "") || "0"} in` : `${Math.round(mm)} mm`;
export const fmtWind = (kmh: number, u: Units) => (u === "imperial" ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`);
export function dayName(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Things worth acting on in the next 3 days. Thresholds (metric):
 * frost ≤ 2°C · heatwave ≥ 35°C and 5° above last week, or ≥ 45°C ·
 * strong wind ≥ 40 km/h · heavy rain ≥ 25 mm.
 * (The heatwave rule is relative so Dubai's normal summer doesn't alarm daily.)
 */
export function weatherAlerts(w: WeatherData, u: Units): WeatherAlert[] {
  const pastMax = w.past.length ? w.past.reduce((s, d) => s + d.max, 0) / w.past.length : null;
  const out: WeatherAlert[] = [];
  for (const d of w.next.slice(0, 3)) {
    const weekday = dayName(d.date).split(" ")[0]; // "Thu"
    const night = d.date === w.today ? "tonight" : `${weekday} night`;
    const label = d.date === w.today ? "today" : weekday;
    if (d.min <= 2) out.push({ kind: "frost", date: d.date, text: `${d.min <= -2 ? "Hard frost" : "Frost possible"} ${night} (low ${fmtTemp(d.min, u)})` });
    const hot = d.max >= 45 || (d.max >= 35 && pastMax !== null && d.max >= pastMax + 5);
    if (hot) out.push({ kind: "heat", date: d.date, text: `Heatwave ${label} (high ${fmtTemp(d.max, u)})` });
    if (d.wind >= 40) out.push({ kind: "wind", date: d.date, text: `Strong wind ${label} (up to ${fmtWind(d.wind, u)})` });
    if (d.rain >= 25) out.push({ kind: "rain", date: d.date, text: `Heavy rain ${label} (${fmtRain(d.rain, u)})` });
  }
  return out;
}

/** The weather section of Claude's briefing (outdoor plants only). */
export function weatherBriefing(w: WeatherData, u: Units, place: string): string {
  const range = (xs: number[]) => (xs.length ? `${fmtTemp(Math.min(...xs), u)}–${fmtTemp(Math.max(...xs), u)}` : "unknown");
  const wet = w.past.filter((d) => d.rain >= 1);
  const totalRain = w.past.reduce((s, d) => s + d.rain, 0);
  const alerts = weatherAlerts(w, u);
  return [
    `## Weather at ${place} (outdoor plant — use this)`,
    `- Past 7 days: ${wet.length ? `${fmtRain(totalRain, u)} of rain over ${wet.length} day${wet.length === 1 ? "" : "s"}` : "no meaningful rain"}; highs ${range(w.past.map((d) => d.max))}; lows ${range(w.past.map((d) => d.min))}`,
    `- Next 7 days:`,
    ...w.next.map(
      (d) =>
        `  - ${d.date === w.today ? "Today" : dayName(d.date)}: ${fmtTemp(d.min, u)}–${fmtTemp(d.max, u)}, rain ${fmtRain(d.rain, u)}${d.rainChance != null ? ` (${d.rainChance}% chance)` : ""}, wind up to ${fmtWind(d.wind, u)}`,
    ),
    alerts.length ? `- Watch out: ${alerts.map((a) => a.text).join("; ")}` : `- No frost, heatwave, strong wind or heavy rain expected in the next 3 days`,
  ].join("\n");
}

/** One-line summary for the plant page, e.g. "This week: 12–24°C · 18 mm rain expected". */
export function weekSummary(w: WeatherData, u: Units): string {
  const mins = w.next.map((d) => d.min);
  const maxs = w.next.map((d) => d.max);
  const rain = w.next.reduce((s, d) => s + d.rain, 0);
  return `Next 7 days: ${fmtTemp(Math.min(...mins), u)} to ${fmtTemp(Math.max(...maxs), u)} · ${rain >= 1 ? `${fmtRain(rain, u)} rain expected` : "little or no rain"}`;
}
