/**
 * home-weather.ts — the weather for the signed-in person's home.
 *
 * 📘 LEARN: Looks up the home's map position the first time it's needed
 * (and remembers it in the database), then fetches the weather. Wrapped in
 * React's cache() so a page that asks several times makes one request.
 */
import { cache } from "react";
import { store } from "@/lib/store";
import type { HomeInfo } from "@/lib/types";
import { geocode, getWeather, type WeatherData } from "@/lib/weather";

/** Makes sure the home has a map position; returns it (or null if the place can't be found). */
export const ensureHomeCoords = cache(async (home: HomeInfo) => {
  if (home.latitude != null && home.longitude != null) return { latitude: home.latitude, longitude: home.longitude, place: home.weatherPlace ?? home.location ?? "" };
  if (!home.location) return null;
  const found = await geocode(home.location);
  if (!found) return null;
  try {
    await store.updateHome({ latitude: found.latitude, longitude: found.longitude, weatherPlace: found.place });
  } catch {
    /* saving is a nice-to-have; we can still use it this time */
  }
  return { latitude: found.latitude, longitude: found.longitude, place: found.place };
});

export const getHomeWeather = cache(async (home: HomeInfo): Promise<{ data: WeatherData; place: string } | null> => {
  const at = await ensureHomeCoords(home);
  if (!at) return null;
  const data = await getWeather(at.latitude, at.longitude);
  return data ? { data, place: at.place } : null;
});
