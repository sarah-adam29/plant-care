"use server";
/**
 * login/actions.ts — passwordless sign-in.
 * 📘 LEARN: Supabase emails a one-time code (and a link). Typing the code works
 * everywhere — including the home-screen app, where email links open Safari.
 *
 * Plant Care is invite-only: before sending a code we ask the database whether
 * this email already has an account, is on the approved list, or was invited.
 * Otherwise no email is sent (which also protects the free email allowance).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function sendCodeAction(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseServer();
  const allowed = await sb.rpc("email_allowed", { e: email.trim().toLowerCase() });
  if (allowed.error) return { ok: false, error: "Couldn't check your email just now. Try again in a moment." };
  if (!allowed.data)
    return { ok: false, error: "Plant Care is invite-only for now. Ask the person who shared it with you to add this email, then try again." };
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error?.message.toLowerCase().includes("rate limit"))
    return { ok: false, error: "Too many emails sent for now (Supabase's free email limit). Wait about an hour, or ask Claude for the no-email sign-in code." };
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyCodeAction(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseServer();
  const e = email.trim().toLowerCase();
  const t = token.trim();
  // First-ever sign-in sends a "signup" code; later ones send a sign-in code. Accept either.
  let { error } = await sb.auth.verifyOtp({ email: e, token: t, type: "email" });
  if (error) ({ error } = await sb.auth.verifyOtp({ email: e, token: t, type: "signup" }));
  if (error) return { ok: false, error: "That code didn't work. Check it, or request a new one." };
  redirect("/");
}

export async function signOutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
