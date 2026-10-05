"use client";
/**
 * form.tsx — the editable "Where it lives" form.
 *
 * 📘 LEARN: It starts pre-filled with the current values and shows a live
 * preview of what will change before you save — the same wording that goes
 * into the timeline.
 */
import { useState, useTransition } from "react";
import { updateEnvironmentAction } from "@/app/actions";
import { EnvironmentFields, Field, inputCls } from "@/components/environment-fields";
import { diffEnv } from "@/lib/environment";
import type { CurrentEnvironment, Units } from "@/lib/types";

export function EditEnvironmentForm({ plantId, initial, caretaker, units }: { plantId: string; initial: CurrentEnvironment; caretaker: string; units: Units }) {
  const [env, setEnv] = useState<CurrentEnvironment>(initial);
  const [reason, setReason] = useState("");
  const [actor, setActor] = useState(caretaker);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof CurrentEnvironment>(k: K, v: CurrentEnvironment[K]) => setEnv((e) => ({ ...e, [k]: v }));
  const changes = diffEnv(initial, env, units);

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateEnvironmentAction(plantId, env, actor, reason);
      } catch (e) {
        if (!String(e).includes("NEXT_REDIRECT")) setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <EnvironmentFields env={env} set={set} showDetails units={units} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Why the change?" hint="optional">
          <input className={inputCls} placeholder="e.g. Repotted into a pot with holes" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Who">
          <input className={inputCls} value={actor} onChange={(e) => setActor(e.target.value)} />
        </Field>
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-[17px]">What will change</h2>
        {changes.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Nothing yet. Edit a field above.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[15px]">
            {changes.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden className="mt-2.5 h-[3px] w-3 shrink-0 rounded-[1px] bg-leaf" />
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={save}
        disabled={pending || (changes.length === 0 && !reason.trim())}
        className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
      {error && <p className="rounded-md bg-critical-soft px-3 py-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
