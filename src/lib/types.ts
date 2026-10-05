/**
 * types.ts — the shape of everything the app remembers.
 *
 * 📘 LEARN: This file is the "data model". Every screen, every AI prompt and
 * the database all agree on these shapes. When you want the app to remember
 * something new (e.g. "floor height"), you start here.
 *
 * The AI output shapes are defined with `zod`, a library that lets us describe
 * a shape once and get (1) a TypeScript type and (2) a runtime validator.
 * We hand the same zod schema to Claude so its answer is guaranteed to fit.
 */
import { z } from "zod";

// ── Small shared vocabularies ────────────────────────────────────────────────

export const HealthStatus = z.enum(["healthy", "watch", "stressed", "critical"]);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const Severity = z.enum(["ok", "minor", "major", "unknown"]);
export type Severity = z.infer<typeof Severity>;

export const PotSetup = z.enum(["drainage", "cachepot", "no-drainage", "unknown"]);
export type PotSetup = z.infer<typeof PotSetup>;

export const WindowDirection = z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW", "none", "unknown"]);
export type WindowDirection = z.infer<typeof WindowDirection>;

// ── What the plant would like (from identification) ─────────────────────────

export const IdealEnvironment = z.object({
  light: z.string().describe("e.g. 'Bright indirect; tolerates gentle morning sun'"),
  temperature: z.string().describe("Range in the user's units (°C or °F) plus draft/cold/heat sensitivity"),
  humidity: z.string(),
  watering: z.string().describe("When to water, framed as a soil check, never a fixed schedule"),
  soil: z.string(),
  drainage: z.string(),
  sensitivities: z.array(z.string()).describe("e.g. 'fluoride in tap water', 'being moved'"),
  toxicity: z.string().describe("Pet/child toxicity note"),
});
export type IdealEnvironment = z.infer<typeof IdealEnvironment>;

// ── Where the plant actually lives (from the user) ──────────────────────────

export type Setting = "indoor" | "balcony" | "patio" | "garden-bed" | "garden-pot";

export type CurrentEnvironment = {
  setting?: Setting; // missing = indoor (plants added before Phase 5)
  room?: string; // indoors: the room; outdoors: the spot ("balcony railing, west corner")
  windowDirection?: WindowDirection;
  distanceFromWindowCm?: number;
  directSun?: "none" | "brief" | "several-hours" | "unknown";
  nearAc?: "yes" | "no" | "unknown";
  potSetup?: PotSetup;
  waterSource?: "tap" | "bottled" | "filtered" | "unknown";
  wateringHabit?: string; // what the user actually does, e.g. "weekly"
  roomTemp?: string; // e.g. "20–23°C (AC)"
  notes?: string; // anything else: floor height, curtain, etc.
  // Outdoors only (Phase 5, step 3) — windowDirection doubles as "which way it faces"
  sunHours?: "full" | "part" | "shade" | "unknown";
  wind?: "sheltered" | "some" | "exposed" | "unknown";
  rain?: "yes" | "partly" | "no" | "unknown"; // does rain reach it?
  waterMethod?: "hand" | "hose" | "drip" | "rain-only" | "unknown";
  movable?: "yes" | "no" | "unknown"; // can it go indoors / under cover for frost or heat?
};

// ── Identification result (AI output) ────────────────────────────────────────

export const Identification = z.object({
  commonName: z.string(),
  botanicalName: z.string(),
  confidence: Confidence,
  alternatives: z.array(z.string()).describe("Other plausible IDs, empty if confident"),
  confirmationTip: z.string().describe("How the user can confirm if unsure; empty string if confident"),
  description: z.string().describe("2–3 friendly sentences incl. growth habit and a care quirk"),
  ideal: IdealEnvironment,
});
export type Identification = z.infer<typeof Identification>;

// ── Assessment / coaching (AI output) ───────────────────────────────────────

export const Assessment = z.object({
  status: HealthStatus,
  headline: z.string().describe("One sentence the user sees first"),
  diagnosis: z.string().describe("2–4 sentences; cite the history that supports it"),
  likelyCauses: z.array(
    z.object({ cause: z.string(), confidence: Confidence, evidence: z.string() }),
  ),
  mismatches: z.array(
    z.object({
      factor: z.string().describe("Light, Watering, Drainage, Humidity, Temperature, Water quality…"),
      ideal: z.string(),
      current: z.string(),
      severity: Severity,
    }),
  ),
  doNow: z.array(z.string()),
  monitor: z.array(z.string()),
  longerTerm: z.array(z.string()),
  nextChecks: z.array(z.object({ inDays: z.number(), task: z.string() })),
  questions: z.array(z.string()).describe("Up to 3 questions that would most sharpen the diagnosis"),
  moisture: z
    .object({
      waterAtOrBelow: z.number().describe("Moisture-meter reading (1–10) at or below which to water this plant, right now"),
      reason: z.string().describe("One short sentence: why this threshold for this plant, pot, light and season"),
    })
    .nullable()
    .describe("Only when the user owns a moisture meter; otherwise null"),
});
export type Assessment = z.infer<typeof Assessment>;

// ── Stored records ──────────────────────────────────────────────────────────

export type Plant = {
  id: string;
  nickname: string;
  commonName: string;
  botanicalName: string;
  idConfidence: Confidence;
  description: string;
  owner: string;
  caretaker: string;
  home: string;
  photoUrl: string | null;
  ideal: IdealEnvironment;
  current: CurrentEnvironment;
  moistureWaterAt?: number | null; // user's own override of the watering threshold (1–10)
  createdAt: string; // ISO
};

// Older saved assessments predate the moisture field, so it's optional here.
export type StoredAssessment = Omit<Assessment, "moisture"> & {
  moisture?: Assessment["moisture"];
  id: string;
  plantId: string;
  createdAt: string;
  model: string;
};

export const EVENT_TYPES = [
  "watered",
  "checked-soil",
  "moved",
  "repotted",
  "pruned",
  "fertilized",
  "treated",
  "symptom",
  "photo",
  "caretaker-change",
  "conditions-changed",
  "moisture-reading",
  "note",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type PlantEvent = {
  id: string;
  plantId: string;
  occurredAt: string; // ISO date; may be approximate
  approximate?: boolean; // "~Jul 2026"
  type: EventType;
  actor: string; // who did it — this is what caught Spike's change-of-caretaker problem
  note: string;
  photoUrl?: string | null;
  loggedAt?: string; // ISO timestamp of when it was entered (drives the "new info" nudge)
  reading?: number; // moisture-meter reading 1–10 (for "moisture-reading" events)
};

// ── Household equipment (drives equipment-aware advice) ─────────────────────
export const EQUIPMENT = [
  { id: "moisture-meter", label: "Moisture meter", detail: "Analog, 1–10 scale, ~10 cm probe (1–3 dry · 4–7 moist · 8–10 wet)" },
  { id: "light-meter", label: "Light meter", detail: "Or a light-meter phone app" },
  { id: "hygrometer", label: "Humidity meter", detail: "Shows room humidity %" },
  { id: "humidifier", label: "Humidifier", detail: "" },
  { id: "grow-light", label: "Grow light", detail: "" },
  { id: "pruning-shears", label: "Pruning scissors", detail: "" },
] as const;
export type EquipmentId = (typeof EQUIPMENT)[number]["id"];
export type Settings = { equipment: EquipmentId[] };

// ── Where the home is (Phase 5) ─────────────────────────────────────────────
// 📘 LEARN: one location per home gives Claude the climate, season and
// hemisphere (September is spring in Cape Town, autumn in Washington), and
// gives the app the right clock and units.
export type Units = "metric" | "imperial";
export type HomeInfo = {
  location: string | null;
  timezone: string;
  units: Units;
  // Map position for weather, looked up from `location` (Phase 5, step 3)
  latitude?: number | null;
  longitude?: number | null;
  weatherPlace?: string | null; // the place it matched, e.g. "Cape Town, Western Cape, South Africa"
};
// ── "Ask about <plant>" (Phase 5, step 2) ──────────────────────────────────
export type PlantQuestion = {
  id: string;
  plantId: string;
  askerName: string;
  question: string;
  answer: string;
  photoUrl?: string | null;
  addedToTimeline: boolean;
  model?: string | null;
  createdAt: string;
};

export const DEFAULT_HOME: HomeInfo = { location: null, timezone: "UTC", units: "metric" };

export type Check = {
  id: string;
  plantId: string;
  dueOn: string; // ISO date
  task: string;
  doneAt: string | null;
};

/** Everything we know about one plant, assembled for a screen or a prompt. */
export type PlantBundle = {
  plant: Plant;
  latest: StoredAssessment | null;
  events: PlantEvent[];
  checks: Check[];
};
