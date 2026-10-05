/**
 * login-code.ts — get a sign-in code WITHOUT sending an email.
 * Usage:  npm run login-code -- you@example.com
 *
 * 📘 LEARN: Supabase's free built-in email is heavily rate-limited (a few
 * emails an hour). With the secret key we can ask Supabase for a fresh code
 * directly. Handy while developing; don't share the code.
 */
import { supabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("Usage: npm run login-code -- you@example.com");
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const p = data.properties;
  console.log(`\nSign-in code for ${email}:  ${p.email_otp}`);
  console.log(`Or open:  http://localhost:3000/auth/confirm?token_hash=${p.hashed_token}&type=magiclink\n`);
  console.log(`On the login page: enter your email, tap "I already have a code", type the code.`);
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
