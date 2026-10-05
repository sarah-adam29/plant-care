"use server";
/**
 * actions.ts — everything the screens can ask the server to do.
 *
 * 📘 LEARN: These are "Server Actions": functions that run on the server but
 * can be called from a button or form in the browser. The API key and the data
 * file live on the server, so this is the only place that touches them.
 *
 * Every AI action (identify, update advice) first asks the database to count
 * it against the home's daily limit — see `aiAllowed()` below.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { assessPlant, identifyPlant, MODEL } from "@/lib/ai/claude";
import type { Assessment, CurrentEnvironment, EquipmentId, EventType, Identification } from "@/lib/types";
import { diffEnv, isOutdoor } from "@/lib/environment";
import { getHomeWeather } from "@/lib/home-weather";

type Img = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

/** Cost protection: one AI action for this home, or a friendly "come back tomorrow". */
const DAILY_LIMIT_MSG = "Your home has used today's 30 AI actions (identify / update advice). They reset tomorrow.";
async function aiAllowed() {
  return store.useAi();
}

async function saveAssessment(plantId: string, a: Assessment) {
  await store.addAssessment({ ...a, plantId, model: MODEL });
  await store.replaceOpenChecks(
    plantId,
    a.nextChecks.map((c) => ({ dueOn: addDays(c.inDays), task: c.task })),
  );
}

// ── Step 1 of "Add plant": identify from a photo ────────────────────────────
export async function identifyAction(imgs: Img[], hint?: string): Promise<{ ok: true; id: Identification } | { ok: false; error: string }> {
  try {
    if (imgs.length === 0) return { ok: false, error: "Add at least one photo." };
    if (!(await aiAllowed())) return { ok: false, error: DAILY_LIMIT_MSG };
    const { home } = await store.getViewer();
    return { ok: true, id: await identifyPlant(imgs.slice(0, 4), hint, home) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Step 3 of "Add plant": save it and run the first assessment ─────────────
export async function createPlantAction(input: {
  imgs: Img[]; // first = main photo
  identification: Identification;
  nickname: string;
  owner: string;
  current: CurrentEnvironment;
  firstNote?: string;
}) {
  const { imgs, identification: idn } = input;
  const viewer = await store.getViewer();
  const img = imgs[0];
  const photoUrls: string[] = [];
  for (const i of imgs) photoUrls.push(await store.savePhoto(Buffer.from(i.base64, "base64"), i.mediaType.split("/")[1]));
  const photoUrl = photoUrls[0];

  const plant = await store.createPlant({
    nickname: input.nickname.trim() || idn.commonName,
    commonName: idn.commonName,
    botanicalName: idn.botanicalName,
    idConfidence: idn.confidence,
    description: idn.description,
    owner: input.owner || viewer.name,
    caretaker: viewer.name,
    home: viewer.householdName,
    photoUrl,
    ideal: idn.ideal,
    current: input.current,
  });

  await store.addEvent({
    plantId: plant.id,
    occurredAt: new Date().toISOString().slice(0, 10),
    type: "photo",
    actor: plant.caretaker,
    note: input.firstNote?.trim() ? `Added to the app. ${input.firstNote.trim()}` : "Added to the app.",
    photoUrl,
  });
  for (const url of photoUrls.slice(1)) {
    await store.addEvent({ plantId: plant.id, occurredAt: new Date().toISOString().slice(0, 10), type: "photo", actor: plant.caretaker, note: "Extra photo from setup", photoUrl: url });
  }

  // First assessment. If the AI call fails (or the daily limit is used up) we still keep the plant.
  try {
    if (!(await aiAllowed())) throw new Error(DAILY_LIMIT_MSG);
    const bundle = await store.getPlant(plant.id);
    const weather = isOutdoor(bundle!.plant.current) ? await getHomeWeather(viewer.home) : null;
    const { assessment } = await assessPlant(bundle!, img, { settings: await store.getSettings(), home: viewer.home, weather });
    await saveAssessment(plant.id, assessment);
  } catch (e) {
    console.error("First assessment failed:", e);
  }

  revalidatePath("/");
  redirect(`/plants/${plant.id}`);
}

// ── Plant page: log something that happened ─────────────────────────────────
export async function logEventAction(formData: FormData) {
  const plantId = String(formData.get("plantId"));
  const type = String(formData.get("type")) as EventType;
  const actor = String(formData.get("actor") || "").trim() || (await store.getViewer()).name;
  const note = String(formData.get("note") || "");
  const occurredAt = String(formData.get("occurredAt") || new Date().toISOString().slice(0, 10));

  await store.addEvent({ plantId, type, actor, note, occurredAt });
  if (type === "caretaker-change") await store.updatePlant(plantId, { caretaker: actor });
  revalidatePath(`/plants/${plantId}`);
}

// ── Plant page: "What should I do next?" (the coach) ────────────────────────
export async function reassessAction(plantId: string, photo?: Img): Promise<{ ok: boolean; error?: string }> {
  try {
    const bundle = await store.getPlant(plantId);
    if (!bundle) return { ok: false, error: "Plant not found" };
    if (!(await aiAllowed())) return { ok: false, error: DAILY_LIMIT_MSG };

    let photoUrl: string | undefined;
    if (photo) {
      photoUrl = await store.savePhoto(Buffer.from(photo.base64, "base64"), photo.mediaType.split("/")[1]);
      await store.addEvent({
        plantId,
        occurredAt: new Date().toISOString().slice(0, 10),
        type: "photo",
        actor: bundle.plant.caretaker,
        note: "Progress photo",
        photoUrl,
      });
    }

    const fresh = (await store.getPlant(plantId))!;
    const { home } = await store.getViewer();
    const weather = isOutdoor(fresh.plant.current) ? await getHomeWeather(home) : null;
    const { assessment } = await assessPlant(fresh, photo, { settings: await store.getSettings(), home, weather });
    await saveAssessment(plantId, assessment);
    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function completeCheckAction(formData: FormData) {
  const c = await store.completeCheck(String(formData.get("checkId")));
  if (c) {
    await store.addEvent({
      plantId: c.plantId,
      occurredAt: new Date().toISOString().slice(0, 10),
      type: "checked-soil",
      actor: String(formData.get("actor") || "").trim() || (await store.getViewer()).name,
      note: `Done: ${c.task}${formData.get("result") ? ` — ${formData.get("result")}` : ""}`,
    });
    revalidatePath(`/plants/${c.plantId}`);
    revalidatePath("/");
  }
}

// ── Plant page: "Edit where it lives" ───────────────────────────────────────
// Updates the plant's current conditions AND writes what changed to the
// timeline, so Claude sees both the new truth and the history of the change.
export async function updateEnvironmentAction(plantId: string, next: CurrentEnvironment, actor: string, reason?: string) {
  const bundle = await store.getPlant(plantId);
  if (!bundle) throw new Error("Plant not found");
  const changes = diffEnv(bundle.plant.current, next, (await store.getViewer()).home.units);

  if (changes.length > 0 || reason?.trim()) {
    await store.updatePlant(plantId, { current: next });
    await store.addEvent({
      plantId,
      occurredAt: new Date().toISOString().slice(0, 10),
      type: "conditions-changed",
      actor: actor || bundle.plant.caretaker,
      note: [changes.join("; "), reason?.trim()].filter(Boolean).join(". "),
    });
  }
  revalidatePath(`/plants/${plantId}`);
  redirect(`/plants/${plantId}`);
}

// ── Plant page: delete a plant (and everything recorded about it) ───────────
export async function deletePlantAction(plantId: string) {
  await store.deletePlant(plantId);
  revalidatePath("/");
  redirect("/");
}

// ── Plant page: remove one timeline entry (e.g. sent by mistake) ───────────
export async function deleteEventAction(plantId: string, eventId: string) {
  await store.deleteEvent(plantId, eventId);
  revalidatePath(`/plants/${plantId}`);
  revalidatePath("/");
}

// ── Plant page: choose which photo represents the plant ─────────────────────
export async function setMainPhotoAction(formData: FormData) {
  const plantId = String(formData.get("plantId"));
  const photoUrl = String(formData.get("photoUrl"));
  await store.updatePlant(plantId, { photoUrl });
  revalidatePath(`/plants/${plantId}`);
  revalidatePath("/");
}

// ── Settings: which plant-care equipment you own ────────────────────────────
export async function updateEquipmentAction(formData: FormData) {
  const equipment = formData.getAll("equipment").map(String) as EquipmentId[];
  await store.updateSettings({ equipment });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

// ── Plant page: log a moisture-meter reading ────────────────────────────────
export async function logMoistureAction(input: { plantId: string; reading: number; watered: boolean; actor: string; verdict: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const r = Math.max(1, Math.min(10, Math.round(input.reading)));
  await store.addEvent({
    plantId: input.plantId,
    occurredAt: today,
    type: "moisture-reading",
    actor: input.actor,
    reading: r,
    note: `Moisture meter: ${r}/10. ${input.verdict}`,
  });
  if (input.watered) {
    await store.addEvent({ plantId: input.plantId, occurredAt: today, type: "watered", actor: input.actor, note: `Watered after a reading of ${r}/10.` });
  }
  revalidatePath(`/plants/${input.plantId}`);
  revalidatePath("/");
}

// ── Plant page: set (or clear) your own watering threshold ─────────────────
export async function setMoistureTargetAction(plantId: string, waterAt: number | null) {
  await store.updatePlant(plantId, { moistureWaterAt: waterAt });
  revalidatePath(`/plants/${plantId}`);
}

// ── Settings: people in your home ───────────────────────────────────────────
export async function inviteAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
  await store.invite(email);
  revalidatePath("/settings");
}

export async function cancelInviteAction(formData: FormData) {
  await store.cancelInvite(String(formData.get("email")));
  revalidatePath("/settings");
}

// ── Settings: your home (name, location, units, time zone) ─────────────────
export async function updateHomeAction(formData: FormData) {
  const units = formData.get("units") === "imperial" ? "imperial" : "metric";
  await store.updateHome({
    name: String(formData.get("name") || ""),
    location: String(formData.get("location") || ""),
    timezone: String(formData.get("timezone") || "") || undefined,
    units,
  });
  revalidatePath("/", "layout");
  redirect("/settings?home=saved");
}

// ── Settings (app admin): who may start their own home ─────────────────────
export async function allowEmailAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
  await store.allowEmail(email, String(formData.get("note") || ""));
  revalidatePath("/settings");
}

export async function removeAllowedAction(formData: FormData) {
  await store.removeAllowed(String(formData.get("email")));
  revalidatePath("/settings");
}

// ── Plant page: "Save to timeline" under a chat answer ──────────────────────
// Copies one question + answer into the plant's history, so future advice
// knows about it. Only happens when someone taps the button.
export async function addQuestionToTimelineAction(plantId: string, questionId: string) {
  const q = (await store.listQuestions(plantId, 50)).find((x) => x.id === questionId);
  if (!q || q.addedToTimeline) return;
  const answer = q.answer.length > 300 ? q.answer.slice(0, 297) + "…" : q.answer;
  await store.addEvent({
    plantId,
    occurredAt: new Date().toISOString().slice(0, 10),
    type: "note",
    actor: q.askerName,
    note: `Asked: "${q.question}" — Answer: ${answer}`,
    photoUrl: q.photoUrl ?? undefined,
  });
  await store.markQuestionAdded(questionId);
  revalidatePath(`/plants/${plantId}`);
}

