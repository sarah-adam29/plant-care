"use client";
/**
 * environment-fields.tsx — the "Where does it live?" questions.
 *
 * 📘 LEARN: Shared by "Add a plant" and "Edit where it lives", so both screens
 * always ask the same questions in the same way. Change a question here and
 * it changes in both places. This is what "reusable component" means.
 */
import type { CurrentEnvironment, Units } from "@/lib/types";
import { formatDistanceCm } from "@/lib/environment";

export const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-leaf";

export function Chips<T extends string>({ value, onChange, options }: { value?: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md border px-3.5 py-2 text-[15px] ${value === v ? "border-leaf bg-leaf-soft font-semibold text-leaf" : "border-line bg-white hover:border-leaf"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold">
        {label} {hint && <span className="font-normal text-muted">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function lightAt(cm: number) {
  if (cm <= 50) return { label: "Very bright spot", cls: "text-watch" };
  if (cm <= 150) return { label: "Bright spot", cls: "text-healthy" };
  if (cm <= 300) return { label: "Medium light", cls: "text-moss" };
  return { label: "Low light", cls: "text-muted" };
}

/** Distance slider with a readable value, scale labels and what that distance means for light. */
export function DistancePicker({ value, onChange, units = "metric" }: { value?: number; onChange: (cm: number | undefined) => void; units?: Units }) {
  const light = value != null ? lightAt(value) : null;
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-baseline justify-between">
        <span className={`text-xl font-bold tracking-tight ${value == null ? "text-muted" : ""}`}>
          {value == null ? "Drag to set" : value <= 10 ? "On the windowsill" : `${formatDistanceCm(value, units)} from the window`}
        </span>
        {light && <span className={`text-xs font-semibold ${light.cls}`}>{light.label}</span>}
      </div>
      <input
        type="range"
        min={0}
        max={500}
        step={10}
        value={value ?? 0}
        aria-label="Distance from the window"
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--color-leaf)]"
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        {(units === "imperial" ? ["Sill", "3 ft", "6.5 ft", "10 ft", "13 ft", "16 ft+"] : ["Sill", "1 m", "2 m", "3 m", "4 m", "5 m+"]).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      {value != null && (
        <button type="button" onClick={() => onChange(undefined)} className="mt-2 text-xs text-muted underline">
          Not sure — clear
        </button>
      )}
    </div>
  );
}

const SETTINGS: [NonNullable<CurrentEnvironment["setting"]>, string][] = [
  ["indoor", "Indoors"],
  ["balcony", "Balcony"],
  ["patio", "Patio"],
  ["garden-bed", "Garden bed"],
  ["garden-pot", "Pot in the garden"],
];
const DIRECTIONS: [NonNullable<CurrentEnvironment["windowDirection"]>, string][] = [
  ["N", "N"], ["E", "E"], ["S", "S"], ["W", "W"], ["SE", "SE"], ["SW", "SW"], ["unknown", "Not sure"],
];

export function EnvironmentFields({
  env,
  set,
  showDetails = false,
  units = "metric",
}: {
  env: CurrentEnvironment;
  set: <K extends keyof CurrentEnvironment>(k: K, v: CurrentEnvironment[K]) => void;
  showDetails?: boolean; // extra fields on the edit screen
  units?: Units; // the home's units: cm/m or inches/feet
}) {
  const outdoor = !!env.setting && env.setting !== "indoor";
  const inGround = env.setting === "garden-bed";
  return (
    <div className="space-y-5">
      <Field label="Where does it live?">
        <Chips value={env.setting ?? "indoor"} onChange={(v) => set("setting", v)} options={SETTINGS} />
      </Field>

      {outdoor ? (
        <>
          <Field label="Spot" hint="optional">
            <input className={inputCls} placeholder="e.g. Balcony railing, west corner" value={env.room ?? ""} onChange={(e) => set("room", e.target.value)} />
          </Field>
          <Field label="Which way does it face?">
            <Chips value={env.windowDirection} onChange={(v) => set("windowDirection", v)} options={DIRECTIONS} />
          </Field>
          <Field label="Direct sun" hint="on a typical day">
            <Chips
              value={env.sunHours}
              onChange={(v) => set("sunHours", v)}
              options={[["full", "6+ hours"], ["part", "3–6 hours"], ["shade", "Under 3"], ["unknown", "Not sure"]]}
            />
          </Field>
          <Field label="Wind">
            <Chips value={env.wind} onChange={(v) => set("wind", v)} options={[["sheltered", "Sheltered"], ["some", "Some"], ["exposed", "Exposed"], ["unknown", "Not sure"]]} />
          </Field>
          <Field label="Does rain reach it?">
            <Chips value={env.rain} onChange={(v) => set("rain", v)} options={[["yes", "Yes"], ["partly", "Partly"], ["no", "No, it's covered"], ["unknown", "Not sure"]]} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Room">
            <input className={inputCls} placeholder="e.g. Living room, bookshelf" value={env.room ?? ""} onChange={(e) => set("room", e.target.value)} />
          </Field>
          <Field label="Nearest window faces">
            <Chips value={env.windowDirection} onChange={(v) => set("windowDirection", v)} options={DIRECTIONS} />
          </Field>
          <Field label="Distance from the window">
            <DistancePicker value={env.distanceFromWindowCm} onChange={(v) => set("distanceFromWindowCm", v)} units={units} />
          </Field>
          <Field label="Direct sun on the leaves">
            <Chips value={env.directSun} onChange={(v) => set("directSun", v)} options={[["none", "None"], ["brief", "Briefly"], ["several-hours", "Hours"], ["unknown", "Not sure"]]} />
          </Field>
          <Field label="Near the AC?" hint="within ~2 m or in its airflow">
            <Chips value={env.nearAc} onChange={(v) => set("nearAc", v)} options={[["yes", "Yes"], ["no", "No"], ["unknown", "Not sure"]]} />
          </Field>
          {showDetails && (
            <Field label="Room temperature" hint="if you know it">
              <input
                className={inputCls}
                placeholder={units === "imperial" ? "e.g. 68–73°F, AC on most of the day" : "e.g. 20–23°C, AC on most of the day"}
                value={env.roomTemp ?? ""}
                onChange={(e) => set("roomTemp", e.target.value)}
              />
            </Field>
          )}
        </>
      )}

      {!inGround && (
        <Field label="Pot" hint="lift it and look underneath">
          <Chips
            value={env.potSetup}
            onChange={(v) => set("potSetup", v)}
            options={[["drainage", "Has holes"], ["cachepot", "Plastic pot inside a nicer pot"], ["no-drainage", "No holes"], ["unknown", "Not sure"]]}
          />
        </Field>
      )}
      {outdoor && (
        <Field label="How is it watered?">
          <Chips
            value={env.waterMethod}
            onChange={(v) => set("waterMethod", v)}
            options={[["hand", "By hand"], ["hose", "Hose"], ["drip", "Drip / irrigation"], ["rain-only", "Rain only"]]}
          />
        </Field>
      )}
      <Field label="Water">
        <Chips value={env.waterSource} onChange={(v) => set("waterSource", v)} options={[["tap", "Tap"], ["bottled", "Bottled"], ["filtered", "Filtered"]]} />
      </Field>
      <Field label="How do you water it now?">
        <input className={inputCls} placeholder="e.g. Check soil first, roughly every 10 days" value={env.wateringHabit ?? ""} onChange={(e) => set("wateringHabit", e.target.value)} />
      </Field>
      {outdoor && (
        <Field label="Could you move it under cover?" hint="for frost or a heatwave">
          <Chips value={env.movable} onChange={(v) => set("movable", v)} options={[["yes", "Yes"], ["no", "No"], ["unknown", "Not sure"]]} />
        </Field>
      )}
      {showDetails && (
        <Field label="Other details" hint="optional">
          <textarea
            className={inputCls}
            rows={2}
            placeholder={
              outdoor
                ? "e.g. 12th floor; gets afternoon glare off the building opposite"
                : units === "imperial"
                  ? "e.g. Under a desk; AC about 20 ft away; sheer curtain"
                  : "e.g. Under a desk; AC about 6 m away; sheer curtain"
            }
            value={env.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
