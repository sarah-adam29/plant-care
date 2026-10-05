/**
 * store/index.ts — the one door to the app's memory.
 *
 * Two implementations, same functions: local-file.ts (JSON on your Mac) and
 * supabase.ts (cloud, with logins). PLANT_STORE=supabase in .env.local picks the cloud.
 *
 * 📘 LEARN: Screens never talk to the database directly; they call these
 * functions. Today they're backed by a local JSON file (`local-file.ts`) so the
 * app runs on your Mac with zero setup. In Phase 4 we'll add a Supabase version
 * with the same functions, and nothing else in the app has to change.
 * This pattern is called an "adapter" (or "repository").
 */
import type { Check, Plant, PlantBundle, PlantEvent, Settings, StoredAssessment, HomeInfo, Units, PlantQuestion } from "@/lib/types";
import { localFileStore } from "./local-file";
import { supabaseStore } from "./supabase";
import { STORE_MODE } from "./mode";

export interface PlantStore {
  listPlants(): Promise<PlantBundle[]>;
  getPlant(id: string): Promise<PlantBundle | null>;
  createPlant(plant: Omit<Plant, "id" | "createdAt">): Promise<Plant>;
  updatePlant(id: string, patch: Partial<Omit<Plant, "id">>): Promise<void>;
  deletePlant(id: string): Promise<void>; // removes the plant and its history, checks and assessments
  addEvent(event: Omit<PlantEvent, "id">): Promise<PlantEvent>;
  deleteEvent(plantId: string, eventId: string): Promise<void>; // removes one timeline entry
  addAssessment(a: Omit<StoredAssessment, "id" | "createdAt">): Promise<StoredAssessment>;
  replaceOpenChecks(plantId: string, checks: Omit<Check, "id" | "plantId" | "doneAt">[]): Promise<void>;
  completeCheck(id: string): Promise<Check | null>;
  savePhoto(bytes: Buffer, ext: string): Promise<string>; // returns a URL
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  // People & home
  getViewer(): Promise<Viewer>;
  listMembers(): Promise<{ name: string; role: string; you: boolean }[]>;
  listInvites(): Promise<string[]>;
  invite(email: string): Promise<void>;
  cancelInvite(email: string): Promise<void>;
  updateHome(patch: {
    name?: string;
    location?: string | null;
    timezone?: string;
    units?: Units;
    latitude?: number | null;
    longitude?: number | null;
    weatherPlace?: string | null;
  }): Promise<void>;
  // Approved sign-ups (app admin only)
  listAllowed(): Promise<{ email: string; note: string | null }[]>;
  allowEmail(email: string, note?: string): Promise<void>;
  removeAllowed(email: string): Promise<void>;
  // Cost protection: counts one AI action for this home; false once today's limit is reached
  useAi(): Promise<boolean>;
  // "Ask about <plant>": newest first
  listQuestions(plantId: string, limit?: number): Promise<PlantQuestion[]>;
  addQuestion(q: Omit<PlantQuestion, "id" | "createdAt" | "addedToTimeline">): Promise<PlantQuestion>;
  markQuestionAdded(id: string): Promise<PlantQuestion | null>;
}

export type Viewer = { name: string; email: string | null; householdName: string; home: HomeInfo; isAdmin: boolean };

export const store: PlantStore = STORE_MODE === "supabase" ? supabaseStore : localFileStore;
