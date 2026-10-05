/** Which store is active: "local" (JSON file on this Mac) or "supabase" (cloud). Set PLANT_STORE in .env.local. */
export const STORE_MODE: "local" | "supabase" = process.env.PLANT_STORE === "supabase" ? "supabase" : "local";
