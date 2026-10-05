/**
 * supabase/server.ts — talk to Supabase AS THE SIGNED-IN PERSON.
 *
 * 📘 LEARN: This client carries the user's login (from cookies), so the
 * database's security rules (RLS) decide what they can see. Use it for
 * everything the app does on someone's behalf.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (read-only cookies) — the proxy refreshes sessions instead.
        }
      },
    },
  });
}
