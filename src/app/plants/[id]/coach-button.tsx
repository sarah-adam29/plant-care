"use client";
/**
 * coach-button.tsx — "What should I do next?"
 *
 * 📘 LEARN: A *Client Component* ("use client") runs in the browser, so it
 * can hold state (loading, errors) and use the camera. It calls the
 * `reassessAction` Server Action, which builds the plant's full briefing and
 * asks Claude. Optionally attaches a fresh progress photo.
 */
import { useRef, useState, useTransition } from "react";
import { reassessAction } from "@/app/actions";
import { resizeImage } from "@/lib/image";
import { CameraIcon } from "@/components/icons";

export function CoachButton({ plantId, newSinceAdvice = 0 }: { plantId: string; newSinceAdvice?: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function run(file?: File) {
    setError(null);
    start(async () => {
      const photo = file ? await resizeImage(file) : undefined;
      const res = await reassessAction(plantId, photo && { base64: photo.base64, mediaType: photo.mediaType });
      if (!res.ok) setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => run()}
          disabled={pending}
          className="h-[52px] flex-1 rounded-lg bg-leaf px-4 font-semibold text-white hover:bg-leaf/90 disabled:opacity-60"
        >
          {pending
            ? "Thinking about your plant…"
            : newSinceAdvice > 0
              ? `Update advice · ${newSinceAdvice} new ${newSinceAdvice === 1 ? "entry" : "entries"}`
              : "What should I do next?"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          title="Add a progress photo and reassess"
          aria-label="Add a progress photo and reassess"
          className="h-[52px] rounded-lg border border-line bg-white px-4 font-semibold hover:border-leaf disabled:opacity-60"
        >
          <CameraIcon />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && run(e.target.files[0])}
        />
      </div>
      {error && <p className="mt-2 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
