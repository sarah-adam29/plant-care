"use client";
/**
 * delete-event-button.tsx — remove one timeline entry (e.g. one sent half-written).
 * 📘 LEARN: Same two-tap pattern as "Delete plant": the first tap asks
 * "Delete?", a second tap within 4 seconds removes it. Advice already given
 * isn't changed — tap "Update advice" afterwards if the entry mattered.
 */
import { useEffect, useState, useTransition } from "react";
import { deleteEventAction } from "@/app/actions";

export function DeleteEventButton({ plantId, eventId }: { plantId: string; eventId: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Delete this entry"
      onClick={() => (armed ? start(() => deleteEventAction(plantId, eventId)) : setArmed(true))}
      className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold ${armed ? "bg-critical text-white" : "text-muted hover:text-critical"}`}
    >
      {pending ? "Deleting…" : armed ? "Tap to delete" : "Delete"}
    </button>
  );
}
