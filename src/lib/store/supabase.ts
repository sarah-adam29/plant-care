/**
 * supabase.ts — the cloud version of the store (same functions as local-file.ts).
 *
 * 📘 LEARN: Every call runs as the signed-in person, so the database's
 * security rules (see supabase/schema.sql) only ever return plants from homes
 * they belong to. The app code doesn't have to remember to filter — the
 * database enforces it.
 *
 * Tables use snake_case (common_name); the app uses camelCase (commonName).
 * The small toX / fromX functions below translate between the two.
 */
import { randomUUID } from "crypto";
import { cache } from "react";
import type { PlantStore, Viewer } from "./index";
import type { Check, Plant, PlantEvent, PlantBundle, Settings, StoredAssessment, EquipmentId, HomeInfo, PlantQuestion } from "@/lib/types";
import { DEFAULT_HOME } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";

export const PHOTO_BUCKET = "plant-photos";

// ── Row ⇄ app shape translators ─────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const toPlant = (r: any): Plant => ({
  id: r.id,
  nickname: r.nickname,
  commonName: r.common_name,
  botanicalName: r.botanical_name,
  idConfidence: r.id_confidence,
  description: r.description,
  owner: r.owner,
  caretaker: r.caretaker,
  home: "",
  photoUrl: r.photo_url,
  ideal: r.ideal,
  current: r.current,
  moistureWaterAt: r.moisture_water_at,
  createdAt: r.created_at,
});

const fromPlant = (p: Partial<Plant>) => {
  const row: Record<string, unknown> = {};
  if (p.nickname !== undefined) row.nickname = p.nickname;
  if (p.commonName !== undefined) row.common_name = p.commonName;
  if (p.botanicalName !== undefined) row.botanical_name = p.botanicalName;
  if (p.idConfidence !== undefined) row.id_confidence = p.idConfidence;
  if (p.description !== undefined) row.description = p.description;
  if (p.owner !== undefined) row.owner = p.owner;
  if (p.caretaker !== undefined) row.caretaker = p.caretaker;
  if (p.photoUrl !== undefined) row.photo_url = p.photoUrl;
  if (p.ideal !== undefined) row.ideal = p.ideal;
  if (p.current !== undefined) row.current = p.current;
  if (p.moistureWaterAt !== undefined) row.moisture_water_at = p.moistureWaterAt;
  return row;
};

const toEvent = (r: any): PlantEvent => ({
  id: r.id,
  plantId: r.plant_id,
  occurredAt: r.occurred_at,
  approximate: r.approximate,
  type: r.type,
  actor: r.actor,
  note: r.note,
  photoUrl: r.photo_url,
  reading: r.reading ?? undefined,
  loggedAt: r.logged_at,
});

const toAssessment = (r: any): StoredAssessment => ({ ...r.body, id: r.id, plantId: r.plant_id, createdAt: r.created_at, model: r.model });

const toCheck = (r: any): Check => ({ id: r.id, plantId: r.plant_id, dueOn: r.due_on, task: r.task, doneAt: r.done_at });
/* eslint-enable @typescript-eslint/no-explicit-any */

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
/** For list queries: a missing result counts as an empty list. */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return must(res) ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toQuestion(r: any): PlantQuestion {
  return {
    id: r.id,
    plantId: r.plant_id,
    askerName: r.asker_name,
    question: r.question,
    answer: r.answer,
    photoUrl: r.photo_url,
    addedToTimeline: r.added_to_timeline,
    model: r.model,
    createdAt: r.created_at,
  };
}

// ── Who is signed in, and which home are we in? ─────────────────────────────
/**
 * Who's asking, and which home they belong to.
 * 📘 LEARN (speed): a page asks for this several times (header, plant, settings…).
 * React's cache() makes it run once per page load instead of once per question,
 * and getClaims() checks the login token on the spot instead of phoning Supabase.
 */
const ctx = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) throw new Error("Not signed in");
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };
  const member = must(
    await sb
      .from("household_members")
      .select("household_id, display_name, households(name, location, timezone, units, latitude, longitude, weather_place)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  if (!member) throw new Error("NO_HOUSEHOLD");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = (member as any).households ?? {};
  const home: HomeInfo = {
    location: h.location ?? null,
    timezone: h.timezone ?? DEFAULT_HOME.timezone,
    units: h.units === "imperial" ? "imperial" : "metric",
    latitude: h.latitude ?? null,
    longitude: h.longitude ?? null,
    weatherPlace: h.weather_place ?? null,
  };
  return {
    home,
    sb,
    user,
    householdId: member.household_id as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    householdName: ((member as any).households?.name as string) ?? "My home",
    displayName: member.display_name as string,
  };
});

async function bundles(plantFilter?: string): Promise<PlantBundle[]> {
  const { sb, householdId } = await ctx();
  let q = sb.from("plants").select("*").eq("household_id", householdId).order("created_at");
  if (plantFilter) q = q.eq("id", plantFilter);
  const plants = rows(await q).map(toPlant);
  if (plants.length === 0) return [];
  const ids = plants.map((p) => p.id);
  const [events, assessments, checks] = await Promise.all([
    sb.from("plant_events").select("*").in("plant_id", ids).order("occurred_at", { ascending: false }).order("logged_at", { ascending: false }),
    sb.from("assessments").select("*").in("plant_id", ids).order("created_at", { ascending: false }),
    sb.from("checks").select("*").in("plant_id", ids).order("due_on"),
  ]);
  const ev = rows(events).map(toEvent);
  const as = rows(assessments).map(toAssessment);
  const ck = rows(checks).map(toCheck);
  return plants.map((plant) => ({
    plant,
    latest: as.find((a) => a.plantId === plant.id) ?? null,
    events: ev.filter((e) => e.plantId === plant.id),
    checks: ck.filter((c) => c.plantId === plant.id),
  }));
}

export const supabaseStore: PlantStore = {
  listPlants: () => bundles(),

  async getPlant(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    return (await bundles(id))[0] ?? null;
  },

  async createPlant(input) {
    const { sb, householdId } = await ctx();
    const row = must(await sb.from("plants").insert({ ...fromPlant(input), household_id: householdId }).select("*").single());
    return toPlant(row);
  },

  async updatePlant(id, patch) {
    const { sb } = await ctx();
    must(await sb.from("plants").update(fromPlant(patch)).eq("id", id));
  },

  async deletePlant(id) {
    const { sb } = await ctx();
    must(await sb.from("plants").delete().eq("id", id)); // events, assessments, checks cascade
  },

  async addEvent(input) {
    const { sb } = await ctx();
    const row = must(
      await sb
        .from("plant_events")
        .insert({
          plant_id: input.plantId,
          occurred_at: input.occurredAt,
          approximate: input.approximate ?? false,
          type: input.type,
          actor: input.actor,
          note: input.note,
          photo_url: input.photoUrl ?? null,
          reading: input.reading ?? null,
        })
        .select("*")
        .single(),
    );
    return toEvent(row);
  },

  async deleteEvent(plantId, eventId) {
    const { sb } = await ctx();
    // The database's rules (RLS) only allow this for members of the plant's home.
    must(await sb.from("plant_events").delete().eq("id", eventId).eq("plant_id", plantId));
  },

  async addAssessment(input) {
    const { sb } = await ctx();
    const { plantId, model, ...body } = input;
    const row = must(await sb.from("assessments").insert({ plant_id: plantId, model, status: body.status, body }).select("*").single());
    return toAssessment(row);
  },

  async replaceOpenChecks(plantId, checks) {
    const { sb } = await ctx();
    must(await sb.from("checks").delete().eq("plant_id", plantId).is("done_at", null));
    if (checks.length) must(await sb.from("checks").insert(checks.map((c) => ({ plant_id: plantId, due_on: c.dueOn, task: c.task }))));
  },

  async completeCheck(id) {
    const { sb } = await ctx();
    const row = must(await sb.from("checks").update({ done_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle());
    return row ? toCheck(row) : null;
  },

  async getSettings(): Promise<Settings> {
    const { sb, householdId } = await ctx();
    const row = must(await sb.from("household_settings").select("equipment").eq("household_id", householdId).maybeSingle());
    return { equipment: (row?.equipment ?? []) as EquipmentId[] };
  },

  async updateSettings(patch) {
    const { sb, householdId } = await ctx();
    must(await sb.from("household_settings").upsert({ household_id: householdId, equipment: patch.equipment ?? [] }));
    return { equipment: patch.equipment ?? [] };
  },

  async getViewer(): Promise<Viewer> {
    const c = await ctx();
    const admin = await c.sb.from("app_admins").select("user_id").eq("user_id", c.user.id).maybeSingle();
    return { name: c.displayName, email: c.user.email ?? null, householdName: c.householdName, home: c.home, isAdmin: !!admin.data };
  },

  async updateHome(patch) {
    const { sb, householdId, home } = await ctx();
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name.trim() || "My home";
    if (patch.location !== undefined) {
      row.location = patch.location?.trim() || null;
      // Location actually changed → look the map position up again next time (unless it's being set now).
      if (row.location !== home.location && patch.latitude === undefined) Object.assign(row, { latitude: null, longitude: null, weather_place: null });
    }
    if (patch.latitude !== undefined) row.latitude = patch.latitude;
    if (patch.longitude !== undefined) row.longitude = patch.longitude;
    if (patch.weatherPlace !== undefined) row.weather_place = patch.weatherPlace;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.units !== undefined) row.units = patch.units;
    must(await sb.from("households").update(row).eq("id", householdId));
  },

  // Approved sign-ups — the database only lets the app admin read or change these.
  async listAllowed() {
    const { sb } = await ctx();
    return rows(await sb.from("allowed_emails").select("email, note").order("added_at")).map((r) => ({ email: r.email as string, note: (r.note as string | null) ?? null }));
  },

  async allowEmail(email, note) {
    const { sb, user } = await ctx();
    must(await sb.from("allowed_emails").upsert({ email: email.trim().toLowerCase(), note: note?.trim() || null, added_by: user.id }));
  },

  async removeAllowed(email) {
    const { sb } = await ctx();
    must(await sb.from("allowed_emails").delete().eq("email", email));
  },

  async listQuestions(plantId, limit = 10) {
    const { sb } = await ctx();
    return rows(await sb.from("plant_questions").select("*").eq("plant_id", plantId).order("created_at", { ascending: false }).limit(limit)).map(toQuestion);
  },

  async addQuestion(q) {
    const { sb } = await ctx();
    const row = must(
      await sb
        .from("plant_questions")
        .insert({ plant_id: q.plantId, asker_name: q.askerName, question: q.question, answer: q.answer, photo_url: q.photoUrl ?? null, model: q.model ?? null })
        .select("*")
        .single(),
    );
    return toQuestion(row);
  },

  async markQuestionAdded(id) {
    const { sb } = await ctx();
    const row = must(await sb.from("plant_questions").update({ added_to_timeline: true }).eq("id", id).select("*").maybeSingle());
    return row ? toQuestion(row) : null;
  },

  async useAi() {
    const { sb, householdId } = await ctx();
    const { data, error } = await sb.rpc("use_ai", { h: householdId });
    if (error) throw new Error(error.message);
    return data === true;
  },

  async listMembers() {
    const { sb, householdId, user } = await ctx();
    const list = rows(await sb.from("household_members").select("user_id, display_name, role").eq("household_id", householdId).order("joined_at"));
    return list.map((r) => ({ name: r.display_name, role: r.role, you: r.user_id === user.id }));
  },

  async listInvites() {
    const { sb, householdId } = await ctx();
    return rows(await sb.from("household_invites").select("email").eq("household_id", householdId)).map((r) => r.email as string);
  },

  async invite(email) {
    const { sb, householdId, user } = await ctx();
    must(await sb.from("household_invites").upsert({ household_id: householdId, email: email.trim().toLowerCase(), invited_by: user.id }, { onConflict: "household_id,email" }));
  },

  async cancelInvite(email) {
    const { sb, householdId } = await ctx();
    must(await sb.from("household_invites").delete().eq("household_id", householdId).eq("email", email));
  },

  async savePhoto(bytes, ext) {
    const { sb, householdId } = await ctx();
    const path = `${householdId}/${randomUUID()}.${ext}`;
    must(await sb.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}` }));
    return `/api/photos/sb/${path}`;
  },
};
