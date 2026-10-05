"use client";
/**
 * delete-button.tsx — two-tap delete, so a plant can't be removed by accident.
 * 📘 LEARN: First tap arms the button; the second tap within 5 seconds deletes.
 */
import { useEffect, useState, useTransition } from "react";
import { deletePlantAction } from "@/app/actions";

export function DeletePlantButton({ plantId, nickname }: { plantId: string; nickname: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? start(() => deletePlantAction(plantId)) : setArmed(true))}
      className={`rounded-md border px-3 py-2 text-[13px] font-semibold ${armed ? "border-critical bg-critical text-white" : "border-line text-muted hover:border-critical hover:text-critical"}`}
    >
      {pending ? "Deleting…" : armed ? `Tap again to delete ${nickname} and all its history` : "Delete plant"}
    </button>
  );
}
