/**
 * migrate-to-supabase.ts — copy your local plants, history and photos to the cloud.
 *
 * Usage (after you've signed in once and created your home):
 *   npm run migrate -- you@example.com
 *
 * 📘 LEARN: This uses the secret (master) key, so it can write directly into
 * your home. It only ADDS data — your local .data folder is left untouched,
 * so you can always go back to local mode. Safe to re-run: plants that were
 * already copied are skipped (add --force to copy them again).
 */
import { promises as fs } from "fs";
import path from "path";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { PHOTO_BUCKET } from "../src/lib/store/supabase";
import type { Check, Plant, PlantEvent, Settings, StoredAssessment } from "../src/lib/types";

type Db = { plants: Plant[]; assessments: StoredAssessment[]; events: PlantEvent[]; checks: Check[]; settings?: Settings };

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const force = process.argv.includes("--force");
  if (!email) throw new Error("Usage: npm run migrate -- you@example.com");

  const sb = supabaseAdmin();
  const db = JSON.parse(await fs.readFile(path.join(process.cwd(), ".data", "db.json"), "utf8")) as Db;

  // 1. Find your account and your home
  const { data: users, error: uErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) throw uErr;
  const user = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) throw new Error(`No account for ${email}. Sign in to the app once first.`);
  const { data: member } = await sb.from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) throw new Error("You don't have a home yet. Finish the Welcome step in the app first.");
  const home = member.household_id as string;

  // Safe to re-run: plants already copied (same nickname + creation time) are skipped.
  const { data: existing } = await sb.from("plants").select("nickname, created_at").eq("household_id", home);
  const already = new Set((existing ?? []).map((r) => `${r.nickname}|${new Date(r.created_at).getTime()}`));

  // Make sure the private photo bucket exists (creates it if step B was skipped).
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === PHOTO_BUCKET)) {
    const { error } = await sb.storage.createBucket(PHOTO_BUCKET, { public: false });
    if (error) throw new Error(`Couldn't create the photo bucket: ${error.message}`);
    console.log(`✓ Created private photo bucket "${PHOTO_BUCKET}"`);
  }

  // 2. Photos: upload local ones, keep /seed/ ones as they are
  const uploaded = new Map<string, string>();
  async function photo(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    if (!url.startsWith("/api/photos/") || url.startsWith("/api/photos/sb/")) return url;
    if (uploaded.has(url)) return uploaded.get(url)!;
    const file = url.split("/").pop()!;
    const bytes = await fs.readFile(path.join(process.cwd(), ".data", "photos", file));
    const dest = `${home}/${file}`;
    const { error } = await sb.storage.from(PHOTO_BUCKET).upload(dest, bytes, { contentType: file.endsWith("png") ? "image/png" : "image/jpeg", upsert: true });
    if (error) throw new Error(`Photo upload failed (${file}): ${error.message}`);
    const next = `/api/photos/sb/${dest}`;
    uploaded.set(url, next);
    return next;
  }

  // 3. Settings (equipment)
  if (db.settings) await sb.from("household_settings").upsert({ household_id: home, equipment: db.settings.equipment });

  // 4. Plants and everything attached to them
  const summary: string[] = [];
  for (const p of db.plants) {
    if (!force && already.has(`${p.nickname}|${new Date(p.createdAt).getTime()}`)) {
      summary.push(`– ${p.nickname}: already in the cloud, skipped`);
      continue;
    }
    const { data: row, error } = await sb
      .from("plants")
      .insert({
        household_id: home,
        nickname: p.nickname,
        common_name: p.commonName,
        botanical_name: p.botanicalName,
        id_confidence: p.idConfidence,
        description: p.description,
        owner: p.owner,
        caretaker: p.caretaker,
        photo_url: await photo(p.photoUrl),
        ideal: p.ideal,
        current: p.current,
        moisture_water_at: p.moistureWaterAt ?? null,
        created_at: p.createdAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Plant ${p.nickname}: ${error.message}`);
    const id = row.id as string;

    const events = db.events.filter((e) => e.plantId === p.id);
    const evRows = [];
    for (const e of events) {
      evRows.push({
        plant_id: id,
        occurred_at: e.occurredAt.slice(0, 10),
        approximate: e.approximate ?? false,
        type: e.type,
        actor: e.actor,
        note: e.note,
        photo_url: await photo(e.photoUrl),
        reading: e.reading ?? null,
        logged_at: e.loggedAt ?? `${e.occurredAt.slice(0, 10)}T12:00:00Z`,
      });
    }
    if (evRows.length) {
      const r = await sb.from("plant_events").insert(evRows);
      if (r.error) throw new Error(`Events for ${p.nickname}: ${r.error.message}`);
    }

    const as = db.assessments.filter((a) => a.plantId === p.id);
    if (as.length) {
      const r = await sb.from("assessments").insert(
        as.map(({ id: _id, plantId: _p, createdAt, model, ...body }) => ({ plant_id: id, created_at: createdAt, model, status: body.status, body })),
      );
      if (r.error) throw new Error(`Assessments for ${p.nickname}: ${r.error.message}`);
    }

    const ck = db.checks.filter((c) => c.plantId === p.id);
    if (ck.length) {
      const r = await sb.from("checks").insert(ck.map((c) => ({ plant_id: id, due_on: c.dueOn, task: c.task, done_at: c.doneAt })));
      if (r.error) throw new Error(`Checks for ${p.nickname}: ${r.error.message}`);
    }
    summary.push(`✓ ${p.nickname}: ${events.length} timeline entries, ${as.length} assessments, ${ck.length} checks`);
  }

  console.log(summary.join("\n"));
  console.log(`✓ ${uploaded.size} photos uploaded`);
  console.log(`\nDone. Set PLANT_STORE=supabase in .env.local and restart the app.`);
}

main().catch((e) => {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exit(1);
});
