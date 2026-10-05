/**
 * moisture.ts — everything about the 1–10 analog moisture meter.
 *
 * 📘 LEARN: The meter's printed guide is a useful starting point but it is
 * generic (it lists snake plants — which like to dry out — as "moist" plants).
 * So the app's watering threshold comes from, in order:
 *   1. your own override (you know your meter and pots best),
 *   2. Claude's suggestion from the latest assessment (species + pot + light +
 *      season + history, with the guide as one input),
 *   3. the printed guide, as a fallback for brand-new plants.
 */
import type { PlantBundle } from "@/lib/types";

export function zoneOf(reading: number) {
  if (reading <= 3) return { label: "Dry", cls: "text-critical", bar: "bg-critical" };
  if (reading <= 7) return { label: "Moist", cls: "text-healthy", bar: "bg-healthy" };
  return { label: "Wet", cls: "text-[#2563eb]", bar: "bg-[#2563eb]" };
}

// From the guide that came with the meter: the zone each plant prefers.
// We water when the reading drops to the BOTTOM of that zone.
const GUIDE: [RegExp, number, number][] = [
  [/cact|aloe|jade|crassula|sedum|euphorbia|fiddle|lyrata/i, 1, 3],
  [/bird of paradise|strelitzia|begonia|bromeliad|hoya|spider plant/i, 4, 5],
  [/corn plant|dracaena|anthurium|flamingo|dieffenbachia|african violet|philodendron|monstera/i, 5, 6],
  [/pothos|scindapsus|epipremnum|fern|peperomia|calathea|prayer|croton|palm/i, 6, 7],
];

export function guideZone(commonName: string, botanicalName: string) {
  const name = `${commonName} ${botanicalName}`;
  const hit = GUIDE.find(([re]) => re.test(name));
  return hit ? { low: hit[1], high: hit[2] } : null;
}

/** The threshold the app uses right now, and where it came from. */
export function effectiveTarget(b: PlantBundle): { waterAt: number; source: "you" | "claude" | "guide" | "default"; reason: string } {
  const p = b.plant;
  if (p.moistureWaterAt != null) return { waterAt: p.moistureWaterAt, source: "you", reason: "Set by you." };
  const ai = b.latest?.moisture;
  if (ai) return { waterAt: ai.waterAtOrBelow, source: "claude", reason: ai.reason };
  const g = guideZone(p.commonName, p.botanicalName);
  // Guide zones are generic, so start one step drier than the bottom of the zone
  // (overwatering was the most common problem in Phase 0). Tap "Update advice" for a tailored value.
  if (g) return { waterAt: Math.max(1, g.low - 1), source: "guide", reason: `The meter's guide lists this plant in the ${g.low}–${g.high} zone; starting one step drier to be safe. Tap "Update advice" for a threshold tailored to this plant.` };
  return { waterAt: 3, source: "default", reason: "A cautious starting point until we learn more." };
}

/** What to do after a reading. Deliberately simple and explainable. */
export function verdict(reading: number, waterAt: number, potHasDrainage: boolean) {
  if (reading >= 8 && !potHasDrainage)
    return { action: "no-water" as const, text: "Soil is wet and the pot can't drain. Don't water; check that no water is pooling at the bottom." };
  if (reading >= 8) return { action: "no-water" as const, text: "Soil is wet. Don't water. Check again in about 4–5 days." };
  if (reading <= waterAt)
    return { action: "water" as const, text: "Time to water. Water slowly until it runs out of the bottom, then empty any water left in the outer pot or saucer." };
  const gap = reading - waterAt;
  return { action: "wait" as const, text: `No water needed yet. Check again in about ${gap <= 1 ? "2" : gap <= 3 ? "3–4" : "5–7"} days.` };
}

/** Tips shown next to the meter — how to get a trustworthy reading. */
export const METER_TIPS = [
  "Push the probe about two-thirds of the way down, halfway between the stem and the pot edge.",
  "Take 2–3 readings around the pot and use the middle one.",
  "Wipe the probe clean and dry after each use; don't leave it in the soil.",
  "These meters sense conductivity, so salts or fertiliser can make soil read wetter than it is.",
];
