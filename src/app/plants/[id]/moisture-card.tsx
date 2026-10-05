"use client";
/**
 * moisture-card.tsx — take a moisture-meter reading and get an instant answer.
 *
 * 📘 LEARN: The instant "water / don't water" answer is plain code (lib/moisture.ts),
 * not an AI call — it's free, instant and predictable. The AI's job is the
 * harder part: choosing the right threshold for this plant, and spotting
 * patterns across readings over time.
 */
import { useState, useTransition } from "react";
import { logMoistureAction, setMoistureTargetAction } from "@/app/actions";
import { METER_TIPS, verdict, zoneOf } from "@/lib/moisture";

type Props = {
  plantId: string;
  caretaker: string;
  target: { waterAt: number; source: "you" | "claude" | "guide" | "default"; reason: string };
  potHasDrainage: boolean;
  recent: { reading: number; date: string }[];
};

const SOURCE: Record<Props["target"]["source"], string> = {
  you: "set by you",
  claude: "suggested by Claude for this plant",
  guide: "from the meter's guide",
  default: "starting point",
};

export function MoistureCard({ plantId, caretaker, target, potHasDrainage, recent }: Props) {
  const [reading, setReading] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(target.waterAt);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const v = reading != null ? verdict(reading, target.waterAt, potHasDrainage) : null;

  function log(watered: boolean) {
    if (reading == null || !v) return;
    start(async () => {
      await logMoistureAction({ plantId, reading, watered, actor: caretaker, verdict: watered ? "Watered." : v.action === "water" ? "Not watered yet." : v.text });
      setSaved(watered ? `Saved: ${reading}/10 and watered.` : `Saved: ${reading}/10.`);
      setReading(null);
    });
  }

  return (
    <div>
      {/* Threshold */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px]">
          Water at or below <b className="font-semibold">{target.waterAt}</b>
          <span className="text-muted"> · {SOURCE[target.source]}</span>
        </p>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-[13px] font-semibold text-muted underline hover:text-leaf">
            Change
          </button>
        )}
      </div>
      <p className="mt-0.5 text-sm text-muted">{target.reason}</p>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line p-3">
          <span className="text-sm">Water at or below</span>
          <button onClick={() => setDraft((d) => Math.max(1, d - 1))} className="size-9 rounded-md border border-line text-lg" aria-label="Lower">−</button>
          <span className="w-6 text-center text-lg font-bold">{draft}</span>
          <button onClick={() => setDraft((d) => Math.min(9, d + 1))} className="size-9 rounded-md border border-line text-lg" aria-label="Higher">+</button>
          <button
            onClick={() => start(async () => { await setMoistureTargetAction(plantId, draft); setEditing(false); })}
            className="ml-auto rounded-md bg-leaf px-3 py-2 text-[13px] font-semibold text-white"
          >
            Save
          </button>
          {target.source === "you" && (
            <button
              onClick={() => start(async () => { await setMoistureTargetAction(plantId, null); setEditing(false); })}
              className="rounded-md border border-line px-3 py-2 text-[13px] font-semibold"
            >
              Use suggestion
            </button>
          )}
          <button onClick={() => setEditing(false)} className="text-[13px] text-muted underline">Cancel</button>
        </div>
      )}

      {/* Meter scale */}
      <p className="mt-5 text-sm font-semibold">What does the meter say?</p>
      <div className="mt-2 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const z = zoneOf(n);
          const selected = reading === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => { setReading(n); setSaved(null); }}
              aria-label={`Reading ${n}`}
              className={`relative h-11 rounded-md border text-[15px] font-semibold transition ${selected ? `${z.bar} border-transparent text-white` : `border-line bg-white ${z.cls} hover:border-current`}`}
            >
              {n}
              {n === target.waterAt && <span aria-hidden className="absolute -bottom-2 left-1/2 h-1 w-4 -translate-x-1/2 rounded-sm bg-ink" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-10 text-[11px] font-semibold">
        <span className="col-span-3 text-critical">Dry</span>
        <span className="col-span-4 text-center text-healthy">Moist</span>
        <span className="col-span-3 text-right text-[#2563eb]">Wet</span>
      </div>

      {/* Verdict */}
      {v && reading != null && (
        <div className={`mt-4 rounded-lg p-4 ${v.action === "water" ? "bg-watch-soft" : "bg-tint"}`}>
          <p className="text-[15px] font-semibold">{reading}/10 · {v.action === "water" ? "Water now" : "Don't water"}</p>
          <p className="mt-1 text-[15px]">{v.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {v.action === "water" && (
              <button disabled={pending} onClick={() => log(true)} className="h-11 rounded-lg bg-leaf px-4 text-[15px] font-semibold text-white disabled:opacity-60">
                I watered it
              </button>
            )}
            <button disabled={pending} onClick={() => log(false)} className="h-11 rounded-lg border border-line bg-white px-4 text-[15px] font-semibold disabled:opacity-60">
              {v.action === "water" ? "Just log the reading" : "Log reading"}
            </button>
          </div>
        </div>
      )}
      {saved && <p className="mt-3 text-sm font-semibold text-healthy">{saved}</p>}

      {/* Recent readings */}
      {recent.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold">Recent readings</p>
          <div className="mt-2 flex items-end gap-2">
            {recent.slice().reverse().map((r, i) => {
              const z = zoneOf(r.reading);
              return (
                <div key={i} className="flex w-10 flex-col items-center">
                  <span className={`text-[12px] font-semibold ${z.cls}`}>{r.reading}</span>
                  <span className={`mt-1 w-4 rounded-sm ${z.bar}`} style={{ height: `${r.reading * 5}px` }} />
                  <span className="mt-1 text-[11px] text-muted">
                    {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-semibold text-muted">How to get a good reading</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/85">
          {METER_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </details>
    </div>
  );
}
