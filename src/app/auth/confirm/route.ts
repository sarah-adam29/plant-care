/**
 * Handles the "tap to sign in" link in the email. Supports both link styles:
 *  - ?token_hash=…&type=…  (our custom email template — works in any browser)
 *  - ?code=…               (Supabase's default template — must open in the same browser)
 */
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const sb = await supabaseServer();
  let error: string | null = q.get("error_description");

  const tokenHash = q.get("token_hash");
  const code = q.get("code");
  if (!error && tokenHash) {
    const r = await sb.auth.verifyOtp({ token_hash: tokenHash, type: (q.get("type") ?? "email") as EmailOtpType });
    error = r.error?.message ?? null;
  } else if (!error && code) {
    const r = await sb.auth.exchangeCodeForSession(code);
    error = r.error ? "That link must be opened in the same browser you signed in from. Use the code from the email instead." : null;
  } else if (!error) {
    error = "That sign-in link was incomplete.";
  }

  if (!error) return NextResponse.redirect(new URL("/", request.url));
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
