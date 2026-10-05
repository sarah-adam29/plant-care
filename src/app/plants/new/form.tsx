"use client";
/**
 * plants/new/form.tsx — Add a plant in three steps:
 *   1. Photos (up to 4)  →  2. Confirm what it is  →  3. A few quick questions
 * Then the server saves it and runs the first assessment.
 *
 * 📘 LEARN: One component, with a `step` value deciding what to show.
 * Beginners get sensible defaults; hobbyists can fill in more detail.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { createPlantAction, identifyAction } from "@/app/actions";
import { resizeImage } from "@/lib/image";
import { CameraIcon } from "@/components/icons";
import { EnvironmentFields, Field, inputCls } from "@/components/environment-fields";
import type { CurrentEnvironment, Identification, Units } from "@/lib/types";

type Img = { base64: string; mediaType: "image/jpeg"; previewUrl: string };

const input = inputCls;

export function NewPlantForm({ defaultOwner, units }: { defaultOwner: string; units: Units }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [idn, setIdn] = useState<Identification | null>(null);
  const [nickname, setNickname] = useState("");
  const [owner, setOwner] = useState(defaultOwner);
  const [env, setEnv] = useState<CurrentEnvironment>({ setting: "indoor", potSetup: "unknown", nearAc: "unknown", directSun: "unknown", waterSource: "tap" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof CurrentEnvironment>(k: K, v: CurrentEnvironment[K]) => setEnv((e) => ({ ...e, [k]: v }));

  const MAX_PHOTOS = 4;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - imgs.length;
    const resized = await Promise.all(Array.from(files).slice(0, room).map((f) => resizeImage(f)));
    setImgs((cur) => [...cur, ...resized].slice(0, MAX_PHOTOS));
  }

  function identify(list: Img[] = imgs) {
    setError(null);
    start(async () => {
      const res = await identifyAction(list.map(({ base64, mediaType }) => ({ base64, mediaType })));
      if (!res.ok) return setError(res.error);
      setIdn(res.id);
      setStep(2);
    });
  }

  /** From step 2: add a closer photo and identify again with all photos. */
  async function addAndReidentify(files: FileList | null) {
    if (!files?.length || imgs.length >= MAX_PHOTOS) return;
    const extra = await Promise.all(Array.from(files).slice(0, MAX_PHOTOS - imgs.length).map((f) => resizeImage(f)));
    const next = [...imgs, ...extra];
    setImgs(next);
    identify(next);
  }

  function save() {
    if (imgs.length === 0 || !idn) return;
    setError(null);
    start(async () => {
      try {
        await createPlantAction({ imgs, identification: idn, nickname, owner, current: env, firstNote: note });
      } catch (e) {
        // redirect() throws internally on success — only show real errors
        if (!String(e).includes("NEXT_REDIRECT")) setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-muted hover:text-leaf">← All plants</Link>
      <div>
        <p className="pt-1 text-sm text-muted">Step {step} of 3</p>
        <h1 className="text-3xl font-semibold">
          {step === 1 ? "Photograph your plant" : step === 2 ? "Is this right?" : "Where does it live?"}
        </h1>
      </div>

      {/* Step 1 — photos */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[15px] text-muted">
            Up to {MAX_PHOTOS} photos. The main photo is the one you&apos;ll see in your plant list. More angles mean a more confident ID: <b className="font-semibold text-ink">the whole plant</b>, a{" "}
            <b className="font-semibold text-ink">close-up of a leaf</b>, and <b className="font-semibold text-ink">the base of the stems</b>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {imgs.map((im, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-[10px] bg-tint">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.previewUrl} alt="" className="h-full w-full object-cover" />
                {i === 0 ? (
                  <span className="absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[12px] font-semibold">Main photo</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setImgs((cur) => [cur[i], ...cur.filter((_, j) => j !== i)])}
                    className="absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[12px] font-semibold text-leaf hover:bg-white"
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImgs((cur) => cur.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-white/90 text-ink"
                >
                  ✕
                </button>
              </div>
            ))}
            {imgs.length < MAX_PHOTOS && (
              <label className={`grid cursor-pointer place-items-center rounded-[10px] border-2 border-dashed border-line bg-tint text-center hover:border-leaf ${imgs.length === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"}`}>
                <span className="p-4 text-muted">
                  <CameraIcon className="mx-auto size-8 text-leaf" />
                  <span className="mt-2 block font-semibold text-ink">{imgs.length === 0 ? "Add photos" : "Add another"}</span>
                  <span className="text-sm">{imgs.length === 0 ? "Take new ones or choose from your library" : `${MAX_PHOTOS - imgs.length} more allowed`}</span>
                </span>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>

          <button
            onClick={() => identify()}
            disabled={pending || imgs.length === 0}
            className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Identifying…" : imgs.length > 1 ? `Identify from ${imgs.length} photos` : "Identify"}
          </button>
        </div>
      )}

      {/* Step 2 — confirm identification */}
      {step === 2 && idn && imgs.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgs[0].previewUrl} alt="" className="size-28 rounded-[10px] object-cover" />
            <div>
              <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${idn.confidence === "high" ? "text-healthy" : idn.confidence === "medium" ? "text-watch" : "text-stressed"}`}>
                {idn.confidence} confidence
              </span>
              <h2 className="mt-1 text-2xl font-semibold">{idn.commonName}</h2>
              <p className="text-sm italic text-muted">{idn.botanicalName}</p>
            </div>
          </div>
          <p className="text-[15px] leading-relaxed">{idn.description}</p>
          {idn.confirmationTip && (
            <p className="rounded-lg bg-watch-soft p-4 text-[15px]">
              <b>Not 100% sure.</b> {idn.alternatives.length > 0 && <>Could also be {idn.alternatives.join(" or ")}. </>}
              {idn.confirmationTip}
            </p>
          )}
          {idn.confidence !== "high" && imgs.length < MAX_PHOTOS && (
            <label className={`flex h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:border-leaf hover:text-leaf ${pending ? "pointer-events-none opacity-50" : ""}`}>
              <CameraIcon />
              {pending ? "Checking again…" : `Add a closer photo and check again (${imgs.length}/${MAX_PHOTOS})`}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { addAndReidentify(e.target.files); e.target.value = ""; }} />
            </label>
          )}
          <Field label="Correct the name" hint="if it's wrong">
            <div className="grid grid-cols-2 gap-2">
              <input className={input} value={idn.commonName} onChange={(e) => setIdn({ ...idn, commonName: e.target.value })} />
              <input className={input} value={idn.botanicalName} onChange={(e) => setIdn({ ...idn, botanicalName: e.target.value })} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nickname">
              <input className={input} value={nickname} placeholder="e.g. Rapunzel" onChange={(e) => setNickname(e.target.value)} />
            </Field>
            <Field label="Owner">
              <input className={input} value={owner} onChange={(e) => setOwner(e.target.value)} />
            </Field>
          </div>
          <button onClick={() => setStep(3)} className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white">Looks right</button>
        </div>
      )}

      {/* Step 3 — quick questions */}
      {step === 3 && (
        <div className="space-y-5">
          <EnvironmentFields env={env} set={set} units={units} />
          <Field label="Anything worrying you?" hint="optional">
            <textarea className={input} rows={3} placeholder="e.g. Yellow leaves for ~4 weeks; moved home in July" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button onClick={save} disabled={pending} className="h-[52px] w-full rounded-lg bg-leaf font-semibold text-white disabled:opacity-60">
            {pending ? "Saving and assessing…" : "Save plant"}
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
