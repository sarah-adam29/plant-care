/**
 * local-file.ts — stores everything in `.data/db.json` on your machine.
 *
 * 📘 LEARN: Simple and inspectable: open `.data/db.json` in any editor to see
 * exactly what the app remembers. The first time it runs it copies in the
 * seed data (your five plants from Phase 0). Delete the file to reset.
 * Not suitable for multiple users or hosting — that's what Supabase is for.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { PlantStore } from "./index";
import type { Check, Plant, PlantEvent, StoredAssessment, PlantBundle, Settings, HomeInfo, PlantQuestion } from "@/lib/types";
import { seed } from "./seed";

type Db = {
  plants: Plant[];
  assessments: StoredAssessment[];
  events: PlantEvent[];
  checks: Check[];
  settings?: Settings; // added later — older files won't have it
  home?: { name: string } & HomeInfo; // added in Phase 5
  questions?: PlantQuestion[]; // "Ask about <plant>"
};

const LOCAL_HOME: { name: string } & HomeInfo = { name: "Dubai apartment", location: "Dubai, United Arab Emirates", timezone: "Asia/Dubai", units: "metric" };

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");

// One change at a time: two saves landing together could otherwise lose an update.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Db;
  } catch {
    const fresh = structuredClone(seed) as Db;
    await save(fresh);
    return fresh;
  }
}

async function save(db: Db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // write-then-rename so a crash mid-write can't corrupt the file
  const tmp = `${DB_FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}

function bundle(db: Db, plant: Plant): PlantBundle {
  const assessments = db.assessments.filter((a) => a.plantId === plant.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    plant,
    latest: assessments[0] ?? null,
    events: db.events
      .filter((e) => e.plantId === plant.id)
      // newest first; same-day entries ordered by when they were logged
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || (b.loggedAt ?? "").localeCompare(a.loggedAt ?? "")),
    checks: db.checks.filter((c) => c.plantId === plant.id).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
  };
}

export const localFileStore: PlantStore = {
  listPlants() {
    return locked(async () => {
      const db = await load();
      return db.plants.map((p) => bundle(db, p)).sort((a, b) => a.plant.createdAt.localeCompare(b.plant.createdAt));
    });
  },

  getPlant(id) {
    return locked(async () => {
      const db = await load();
      const plant = db.plants.find((p) => p.id === id);
      return plant ? bundle(db, plant) : null;
    });
  },

  createPlant(input) {
    return locked(async () => {
      const db = await load();
      const plant: Plant = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      db.plants.push(plant);
      await save(db);
      return plant;
    });
  },

  updatePlant(id, patch) {
    return locked(async () => {
      const db = await load();
      const p = db.plants.find((x) => x.id === id);
      if (!p) throw new Error("Plant not found");
      Object.assign(p, patch);
      await save(db);
    });
  },

  deletePlant(id) {
    return locked(async () => {
      const db = await load();
      db.plants = db.plants.filter((p) => p.id !== id);
      db.events = db.events.filter((e) => e.plantId !== id);
      db.assessments = db.assessments.filter((a) => a.plantId !== id);
      db.checks = db.checks.filter((c) => c.plantId !== id);
      await save(db);
    });
  },

  addEvent(input) {
    return locked(async () => {
      const db = await load();
      const event: PlantEvent = { loggedAt: new Date().toISOString(), ...input, id: randomUUID() };
      db.events.push(event);
      await save(db);
      return event;
    });
  },

  deleteEvent(plantId, eventId) {
    return locked(async () => {
      const db = await load();
      db.events = db.events.filter((e) => !(e.id === eventId && e.plantId === plantId));
      await save(db);
    });
  },

  addAssessment(input) {
    return locked(async () => {
      const db = await load();
      const a: StoredAssessment = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      db.assessments.push(a);
      await save(db);
      return a;
    });
  },

  replaceOpenChecks(plantId, checks) {
    return locked(async () => {
      const db = await load();
      // Keep completed checks as history; swap out the still-open ones.
      db.checks = db.checks.filter((c) => c.plantId !== plantId || c.doneAt !== null);
      for (const c of checks) db.checks.push({ ...c, id: randomUUID(), plantId, doneAt: null });
      await save(db);
    });
  },

  completeCheck(id) {
    return locked(async () => {
      const db = await load();
      const c = db.checks.find((x) => x.id === id);
      if (!c) return null;
      c.doneAt = new Date().toISOString();
      await save(db);
      return c;
    });
  },

  getSettings() {
    return locked(async () => (await load()).settings ?? { equipment: [] });
  },

  updateSettings(patch) {
    return locked(async () => {
      const db = await load();
      db.settings = { ...(db.settings ?? { equipment: [] }), ...patch };
      await save(db);
      return db.settings;
    });
  },

  // Local mode = just you on your Mac, so there's one person and one home.
  getViewer() {
    return locked(async () => {
      const h = (await load()).home ?? LOCAL_HOME;
      const { name, ...home } = h;
      return { name: "Sarah", email: null, householdName: name, home, isAdmin: false };
    });
  },
  updateHome(patch) {
    return locked(async () => {
      const db = await load();
      const h = db.home ?? LOCAL_HOME;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      // New location → look the map position up again next time.
      if (patch.location !== undefined && patch.location !== h.location && patch.latitude === undefined) Object.assign(clean, { latitude: null, longitude: null, weatherPlace: null });
      db.home = { ...h, ...clean };
      await save(db);
    });
  },
  async listAllowed() {
    return [];
  },
  async allowEmail() {
    throw new Error("Approving sign-ups needs the cloud version (PLANT_STORE=supabase).");
  },
  async removeAllowed() {},
  async useAi() {
    return true; // no daily cap on your own machine
  },

  listQuestions(plantId, limit = 10) {
    return locked(async () =>
      ((await load()).questions ?? [])
        .filter((q) => q.plantId === plantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  },
  addQuestion(input) {
    return locked(async () => {
      const db = await load();
      const q: PlantQuestion = { ...input, id: randomUUID(), createdAt: new Date().toISOString(), addedToTimeline: false };
      db.questions = [...(db.questions ?? []), q];
      await save(db);
      return q;
    });
  },
  markQuestionAdded(id) {
    return locked(async () => {
      const db = await load();
      const q = (db.questions ?? []).find((x) => x.id === id);
      if (!q) return null;
      q.addedToTimeline = true;
      await save(db);
      return q;
    });
  },
  async listMembers() {
    return [{ name: "Sarah", role: "owner", you: true }];
  },
  async listInvites() {
    return [];
  },
  async invite() {
    throw new Error("Sharing needs the cloud version (PLANT_STORE=supabase).");
  },
  async cancelInvite() {},

  savePhoto(bytes, ext) {
    return locked(async () => {
      await fs.mkdir(PHOTO_DIR, { recursive: true });
      const name = `${randomUUID()}.${ext}`;
      await fs.writeFile(path.join(PHOTO_DIR, name), bytes);
      return `/api/photos/${name}`;
    });
  },
};
