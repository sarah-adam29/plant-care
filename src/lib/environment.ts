/**
 * environment.ts — turn "where it lives" into plain words, and spot changes.
 *
 * 📘 LEARN: Used in three places — the plant page summary, the timeline entry
 * written when you edit conditions ("Near AC: Not sure → No"), and (indirectly)
 * the briefing Claude reads. One source of wording = consistent everywhere.
 */
import type { CurrentEnvironment, Units } from "@/lib/types";

const WORDS: Record<string, Record<string, string>> = {
  setting: { indoor: "Indoors", balcony: "Balcony", patio: "Patio / terrace", "garden-bed": "Garden bed (in the ground)", "garden-pot": "Pot in the garden" },
  directSun: { none: "None", brief: "Briefly", "several-hours": "Several hours", unknown: "Not sure" },
  nearAc: { yes: "Yes", no: "No", unknown: "Not sure" },
  potSetup: { drainage: "Has drainage holes", cachepot: "Plastic pot inside a decorative pot", "no-drainage": "No drainage holes", unknown: "Not sure" },
  waterSource: { tap: "Tap", bottled: "Bottled", filtered: "Filtered", unknown: "Not sure" },
  windowDirection: { none: "No window", unknown: "Not sure" },
  sunHours: { full: "6+ hours (full sun)", part: "3–6 hours (part sun)", shade: "Under 3 hours (shade)", unknown: "Not sure" },
  wind: { sheltered: "Sheltered", some: "Some wind", exposed: "Exposed / windy", unknown: "Not sure" },
  rain: { yes: "Yes", partly: "Partly (covered)", no: "No (fully covered)", unknown: "Not sure" },
  waterMethod: { hand: "By hand", hose: "Hose", drip: "Drip / irrigation", "rain-only": "Rain only", unknown: "Not sure" },
  movable: { yes: "Yes", no: "No (too big or in the ground)", unknown: "Not sure" },
};

/** Outdoors = balcony, patio or garden. Plants added before Phase 5 have no setting → indoors. */
export function isOutdoor(env: CurrentEnvironment) {
  return !!env.setting && env.setting !== "indoor";
}

const INDOOR_LABELS: [keyof CurrentEnvironment, string][] = [
  ["setting", "Where"],
  ["room", "Room"],
  ["windowDirection", "Window faces"],
  ["distanceFromWindowCm", "Distance from window"],
  ["directSun", "Direct sun on leaves"],
  ["nearAc", "Near the AC"],
  ["roomTemp", "Room temperature"],
  ["potSetup", "Pot"],
  ["waterSource", "Water"],
  ["wateringHabit", "Watering habit"],
  ["notes", "Other details"],
];

const OUTDOOR_LABELS: [keyof CurrentEnvironment, string][] = [
  ["setting", "Where"],
  ["room", "Spot"],
  ["windowDirection", "Faces"],
  ["sunHours", "Direct sun"],
  ["wind", "Wind"],
  ["rain", "Rain reaches it"],
  ["potSetup", "Pot"],
  ["waterMethod", "Watered by"],
  ["waterSource", "Water"],
  ["wateringHabit", "Watering habit"],
  ["movable", "Can move under cover"],
  ["notes", "Other details"],
];

/** The labels that apply to this plant (indoor and outdoor plants are asked different things). */
export function envLabels(env: CurrentEnvironment): [keyof CurrentEnvironment, string][] {
  return isOutdoor(env) ? OUTDOOR_LABELS.filter(([k]) => !(k === "potSetup" && env.setting === "garden-bed")) : INDOOR_LABELS;
}

/** Kept for older imports: the indoor list. */
export const ENV_LABELS = INDOOR_LABELS;

export function formatDistanceCm(cm: number, units: Units = "metric") {
  if (cm <= 10) return "On the windowsill";
  if (units === "imperial") {
    const inches = Math.round(cm / 2.54);
    if (cm >= 500) return "16 ft or more";
    if (inches < 36) return `${inches} in`;
    return `${(cm / 30.48).toFixed(1).replace(/\.0$/, "")} ft`;
  }
  if (cm < 100) return `${cm} cm`;
  if (cm >= 500) return "5 m or more";
  return `${(cm / 100).toFixed(1).replace(/\.0$/, "")} m`;
}

export function envValue(key: keyof CurrentEnvironment, env: CurrentEnvironment, units: Units = "metric"): string | null {
  if (key === "setting" && !env.setting) return "Indoors"; // plants added before outdoor support
  const v = env[key];
  if (v === undefined || v === null || v === "") return null;
  if (key === "distanceFromWindowCm") return formatDistanceCm(v as number, units);
  return WORDS[key]?.[String(v)] ?? String(v);
}

/** Human-readable list of what changed, e.g. ["Near the AC: Not sure → No"]. */
export function diffEnv(before: CurrentEnvironment, after: CurrentEnvironment, units: Units = "metric"): string[] {
  const out: string[] = [];
  const labels = new Map([...envLabels(before), ...envLabels(after)]);
  for (const [key, label] of labels) {
    const a = envValue(key, before, units);
    const b = envValue(key, after, units);
    if (a === b) continue;
    out.push(`${label}: ${a ?? "not set"} → ${b ?? "not set"}`);
  }
  return out;
}

/**
 * The same facts, spelled out unambiguously for Claude. Short app labels like
 * "cachepot" can be read two ways (plant straight in a decorative pot, or a
 * nursery pot inside one) — so the briefing says exactly what we mean.
 */
const AI_WORDS: Record<string, Record<string, string>> = {
  potSetup: {
    drainage: "Pot has drainage holes; water drains straight out",
    cachepot: "Plastic nursery pot WITH drainage holes, sitting inside a decorative outer pot that has NO holes (water can collect unseen in the outer pot)",
    "no-drainage": "Planted directly in a pot with NO drainage holes",
    unknown: "Not known whether the pot drains",
  },
  directSun: { none: "No direct sun on the leaves", brief: "Brief direct sun on the leaves", "several-hours": "Several hours of direct sun on the leaves", unknown: "Not known" },
  setting: {
    indoor: "Indoors",
    balcony: "OUTDOORS on a balcony (exposed to wind and reflected heat; pots dry out fast)",
    patio: "OUTDOORS on a patio / terrace at ground level",
    "garden-bed": "OUTDOORS, planted in the ground in a garden bed",
    "garden-pot": "OUTDOORS, in a pot in the garden",
  },
  sunHours: { full: "About 6+ hours of direct sun a day", part: "About 3–6 hours of direct sun a day", shade: "Under 3 hours of direct sun a day (shade)", unknown: "Not known" },
  wind: { sheltered: "Sheltered from wind", some: "Some wind", exposed: "Exposed and windy", unknown: "Not known" },
  rain: { yes: "Rain reaches it directly", partly: "Partly covered: gets some rain", no: "Fully covered: rain doesn't reach it (all water comes from the user)", unknown: "Not known" },
  waterMethod: { hand: "Watered by hand", hose: "Watered with a hose", drip: "On drip / automatic irrigation", "rain-only": "Not watered: relies on rain", unknown: "Not known" },
  movable: { yes: "Can be moved indoors or under cover (e.g. for frost or a heatwave)", no: "Can't be moved (too big or in the ground): protect it where it is", unknown: "Not known" },
  nearAc: { yes: "Yes, within ~2 m or in the airflow", no: "No", unknown: "Not known" },
  waterSource: { tap: "Tap water", bottled: "Bottled water", filtered: "Filtered water", unknown: "Not known" },
};

export function envForAI(key: keyof CurrentEnvironment, env: CurrentEnvironment): string | null {
  const v = env[key];
  if (v === undefined || v === null || v === "") return null;
  return AI_WORDS[key]?.[String(v)] ?? envValue(key, env);
}
