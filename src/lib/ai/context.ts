/**
 * context.ts — the "context builder". ⭐ The heart of the app.
 *
 * 📘 LEARN: Claude doesn't remember anything between calls. Every time we ask
 * for advice, we hand it a briefing: who the plant is, where it lives, how
 * that compares to what it likes, what's changed recently, who has been caring
 * for it, and what we advised last time. The quality of the advice depends
 * mostly on the quality of this briefing — not on clever prompt wording.
 *
 * Design choices:
 *  - Plain, labelled text (models read it well; you can read it too).
 *  - Most recent events first, capped, so the briefing stays small and cheap.
 *  - Days-ago counts computed here, so the model doesn't have to do date maths.
 *  - Caretaker and water source called out explicitly — both were root causes
 *    in Phase 0 (Spike, Big Spike) that a single photo would never reveal.
 */
import { DEFAULT_HOME, EQUIPMENT, type HomeInfo, type PlantBundle, type Settings } from "@/lib/types";
import { effectiveTarget, guideZone } from "@/lib/moisture";
import { envForAI, isOutdoor } from "@/lib/environment";
import { weatherBriefing, type WeatherData } from "@/lib/weather";

const MAX_EVENTS = 25;

export function daysBetween(fromIso: string, to: Date = new Date()): number {
  // Compare calendar days (not hours) so something logged this morning is "today", not "1 days ago".
  const a = new Date(fromIso.slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(to.toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

function ago(days: number) {
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function line(label: string, value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return `- ${label}: ${value}`;
}

/** Today's date where the plant lives (YYYY-MM-DD) — not where the server is. */
export function localDate(today: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  } catch {
    return today.toISOString().slice(0, 10); // unknown time zone → UTC
  }
}

export function buildPlantContext(
  b: PlantBundle,
  today: Date = new Date(),
  settings: Settings = { equipment: [] },
  home: HomeInfo = DEFAULT_HOME,
  weather?: { data: WeatherData; place: string } | null,
): string {
  const { plant: p, latest, events, checks } = b;
  const c = p.current;

  const sections: string[] = [];

  sections.push(
    [
      `## Plant`,
      `- ${p.nickname} — ${p.commonName} (${p.botanicalName}), ID confidence: ${p.idConfidence}`,
      `- Owner: ${p.owner}; current caretaker: ${p.caretaker}; home: ${p.home}`,
    ].join("\n"),
  );

  // 📘 Location → climate, hemisphere and season. Without it Claude would
  // assume one climate for everyone (it used to assume Dubai).
  sections.push(
    [
      `## Home`,
      home.location
        ? `- Location: ${home.location} (work out the climate, hemisphere and current season from this and today's date)`
        : `- Location: not set (keep seasonal advice general)`,
      `- Today (local date): ${localDate(today, home.timezone)}`,
      `- Units: ${home.units === "imperial" ? "imperial — use °F, inches and feet" : "metric — use °C, cm and m"}`,
    ].join("\n"),
  );

  sections.push(
    [
      `## What it likes (ideal)`,
      line("Light", p.ideal.light),
      line("Temperature", p.ideal.temperature),
      line("Humidity", p.ideal.humidity),
      line("Watering", p.ideal.watering),
      line("Soil", p.ideal.soil),
      line("Drainage", p.ideal.drainage),
      line("Sensitivities", p.ideal.sensitivities.join(", ")),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  sections.push(
    [
      `## Where it lives now (current and confirmed — don't ask about these again, except items marked \"Not known\")`,
      ...(isOutdoor(c)
        ? [
            line("Setting", envForAI("setting", c)),
            line("Spot", c.room),
            line("Faces", envForAI("windowDirection", c)),
            line("Direct sun", envForAI("sunHours", c)),
            line("Wind", envForAI("wind", c)),
            line("Rain", envForAI("rain", c)),
            c.setting === "garden-bed" ? null : line("Pot", envForAI("potSetup", c)),
            line("Watering method", envForAI("waterMethod", c)),
            line("Water", envForAI("waterSource", c)),
            line("What the user actually does when watering", c.wateringHabit),
            line("Moving it", envForAI("movable", c)),
            line("Other notes", c.notes),
          ]
        : [
            line("Setting", "Indoors"),
            line("Room", c.room),
            line("Window direction", envForAI("windowDirection", c)),
            line("Distance from window", envForAI("distanceFromWindowCm", c)),
            line("Direct sun", envForAI("directSun", c)),
            line("Near AC", envForAI("nearAc", c)),
            line("Room temperature", c.roomTemp),
            line("Pot", envForAI("potSetup", c)),
            line("Water", envForAI("waterSource", c)),
            line("What the user actually does when watering", c.wateringHabit),
            line("Other notes", c.notes),
          ]),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // 📘 Outdoor plants live with the weather: recent rain, coming frost or heat.
  if (isOutdoor(c)) {
    sections.push(weather ? weatherBriefing(weather.data, home.units, weather.place) : `## Weather\n- Not available right now (give seasonal advice for the location)`);
  }

  const owned = EQUIPMENT.filter((e) => settings.equipment.includes(e.id));
  sections.push(
    owned.length
      ? [`## Equipment the user owns`, ...owned.map((e) => `- ${e.label}${e.detail ? ` (${e.detail})` : ""}`)].join("\n")
      : `## Equipment the user owns\n- None recorded (use finger / pot-weight checks)`,
  );
  if (settings.equipment.includes("moisture-meter")) {
    const t = effectiveTarget(b);
    const g = guideZone(p.commonName, p.botanicalName);
    const readings = events.filter((e) => e.type === "moisture-reading" && e.reading != null).slice(0, 8);
    sections.push(
      [
        `## Moisture meter`,
        `- Current watering threshold: water at or below ${t.waterAt}/10 (source: ${t.source})`,
        g ? `- Meter's printed guide zone for this plant: ${g.low}–${g.high} (generic; use judgement)` : `- Not listed in the meter's printed guide`,
        readings.length
          ? `- Recent readings (newest first): ${readings.map((e) => `${e.reading} on ${e.occurredAt.slice(0, 10)}`).join(", ")}`
          : `- No readings logged yet`,
      ].join("\n"),
    );
  }

  if (events.length) {
    const recent = events.slice(0, MAX_EVENTS);
    sections.push(
      [
        `## History (most recent first)`,
        ...recent.map((e) => {
          const days = daysBetween(e.occurredAt, today);
          const when = `${e.occurredAt.slice(0, 10)}${e.approximate ? " (approx.)" : ""}, ${ago(days)}`;
          return `- [${when}] ${e.type} by ${e.actor}: ${e.note}`;
        }),
        events.length > MAX_EVENTS ? `- …${events.length - MAX_EVENTS} older events omitted` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } else {
    sections.push(`## History\n- None recorded yet (new plant).`);
  }

  if (latest) {
    sections.push(
      [
        `## Previous assessment (${ago(daysBetween(latest.createdAt, today))})`,
        `- Status: ${latest.status}. ${latest.headline}`,
        `- Diagnosis: ${latest.diagnosis}`,
        `- Advised: ${latest.doNow.join("; ")}`,
      ].join("\n"),
    );
  }

  const open = checks.filter((k) => !k.doneAt);
  const done = checks.filter((k) => k.doneAt);
  if (open.length || done.length) {
    sections.push(
      [
        `## Checks`,
        ...done.slice(-5).map((k) => `- DONE ${k.doneAt!.slice(0, 10)}: ${k.task}`),
        ...open.map((k) => `- OPEN, due ${k.dueOn}: ${k.task}`),
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}
