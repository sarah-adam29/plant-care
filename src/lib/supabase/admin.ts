/**
 * supabase/admin.ts — the master-key client. ⚠️ Scripts only (migration).
 *
 * 📘 LEARN: The secret key ignores all security rules. Never import this into
 * a page or Server Action; it's only for one-off scripts run from your Terminal.
 */
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
