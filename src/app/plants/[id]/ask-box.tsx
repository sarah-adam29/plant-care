"use client";
/**
 * ask-box.tsx — "Ask about <plant>": a quick question, a short answer.
 *
 * 📘 LEARN: Sending a question calls our streaming route with `fetch`, then
 * reads the reply piece by piece (`reader.read()`) and adds each piece to the
 * screen — that's what makes the words appear live. When it finishes we ask
 * the page to refresh, which loads the saved question (with its
 * "Save to timeline" button) from the database.
 */
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addQuestionToTimelineAction } from "@/app/actions";
import { resizeImage } from "@/lib/image";
import { CameraIcon } from "@/components/icons";
import type { PlantQuestion } from "@/lib/types";

type Photo = { base64: string; mediaType: "image/jpeg"; previewUrl: string };
type Pending = { question: string; answer: string; photo?: string; startedAt: string; done: boolean };

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function AskBox({ plantId, nickname, questions }: { plantId: string; nickname: string; questions: PlantQuestion[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startRefresh] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Show the live answer until the saved copy arrives from the database.
  const saved = pending && questions.some((q) => q.question === pending.question && q.createdAt >= pending.startedAt.slice(0, 19));
  const live = pending && !saved ? pending : null;
  const busy = !!pending && !pending.done;
  const history = [...questions].reverse(); // oldest first, like a conversation

  async function send() {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    const started = new Date(Date.now() - 2000).toISOString(); // small margin for clock differences
    setPending({ question, answer: "", photo: photo?.previewUrl, startedAt: started, done: false });
    setText("");
    const sentPhoto = photo;
    setPhoto(null);

    try {
      const res = await fetch(`/api/plants/${plantId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, photo: sentPhoto ? { base64: sentPhoto.base64, mediaType: sentPhoto.mediaType } : undefined }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.json().then((j) => j.error).catch(() => null);
        setPending(null);
        setText(question);
        setError(msg ?? "Couldn't send that. Check your connection and try again.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const piece = decoder.decode(value, { stream: true });
        setPending((p) => (p ? { ...p, answer: p.answer + piece } : p));
      }
      setPending((p) => (p ? { ...p, done: true } : p));
      startRefresh(() => router.refresh());
    } catch {
      setPending((p) => (p ? { ...p, done: true, answer: p.answer || "Sorry — the connection dropped. Try again." } : p));
    }
  }

  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-[19px]">Ask about {nickname}</h2>
      <p className="mt-1 text-sm text-muted">Quick questions, short answers. It already knows {nickname}&apos;s history.</p>

      {(history.length > 0 || live) && (
        <ol className="mt-4 space-y-4">
          {history.map((q) => (
            <li key={q.id} className="text-[15px]">
              <p className="font-semibold">
                {q.question} <span className="font-normal text-muted">· {q.askerName}, {when(q.createdAt)}</span>
              </p>
              {q.photoUrl && (
                <div className="relative mt-1.5 h-20 w-16 overflow-hidden rounded-md">
                  <Image src={q.photoUrl} alt="" fill sizes="64px" className="object-cover" unoptimized={q.photoUrl.startsWith("/api/")} />
                </div>
              )}
              <p className="mt-1 leading-relaxed text-ink/85">{q.answer}</p>
              <AddToTimeline plantId={plantId} q={q} />
            </li>
          ))}
          {live && (
            <li className="text-[15px]" aria-live="polite">
              <p className="font-semibold">{live.question}</p>
              {live.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- local preview of the photo you just picked
                <img src={live.photo} alt="" className="mt-1.5 h-20 w-16 rounded-md object-cover" />
              )}
              <p className="mt-1 leading-relaxed text-ink/85">
                {live.answer || <span className="text-muted">Thinking…</span>}
                {!live.done && live.answer && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-leaf" />}
              </p>
            </li>
          )}
        </ol>
      )}

      <div className="mt-4 rounded-lg border border-line p-2 focus-within:border-leaf">
        {photo && (
          <div className="mb-2 flex items-center gap-2 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={photo.previewUrl} alt="" className="h-12 w-10 rounded object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="text-xs text-muted underline">
              Remove photo
            </button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="e.g. Should I water it this week?"
          className="w-full resize-none bg-transparent px-1.5 py-1 text-[15px] outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Add a photo to your question"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-muted hover:text-leaf disabled:opacity-50"
          >
            <CameraIcon className="size-4" /> Photo
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || !text.trim()}
            className="rounded-lg bg-leaf px-4 py-2 text-[15px] font-semibold text-white hover:bg-leaf/90 disabled:opacity-50"
          >
            {busy ? "Answering…" : "Ask"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setPhoto(await resizeImage(f));
          }}
        />
      </div>
      {error && <p className="mt-2 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">{error}</p>}
    </section>
  );
}

/** One tap copies the question + answer into the plant's timeline (never automatic). */
function AddToTimeline({ plantId, q }: { plantId: string; q: PlantQuestion }) {
  const [pending, start] = useTransition();
  if (q.addedToTimeline) return <p className="mt-1.5 text-[13px] text-healthy">On the timeline</p>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => addQuestionToTimelineAction(plantId, q.id))}
      className="mt-1.5 rounded-md border border-line px-2.5 py-1 text-[13px] font-semibold text-muted hover:border-leaf hover:text-leaf disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save to timeline"}
    </button>
  );
}
