/**
 * proxy.ts — runs before every page (Next.js 16's new name for "middleware").
 *
 * 📘 LEARN: In cloud mode it (1) keeps the login session fresh, (2) sends
 * signed-out visitors to /login, and (3) sends signed-in people who don't
 * belong to a home yet to /welcome. In local mode it does nothing.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC = ["/login", "/auth"];
const HOME_COOKIE = "pc_home";

export async function proxy(request: NextRequest) {
  if (process.env.PLANT_STORE !== "supabase") return NextResponse.next();

  let response = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() checks the login token here instead of asking Supabase every time (faster).
  const { data } = await sb.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  if (!userId && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Has this person got a home yet? Remember the answer for a day in a small cookie,
  // so we don't ask the database on every tap. (Only decides where to send you —
  // the database's own rules still decide what you can see.)
  if (userId && !isPublic && path !== "/welcome" && !path.startsWith("/api/") && request.cookies.get(HOME_COOKIE)?.value !== userId) {
    const { count } = await sb.from("household_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    if (!count) return NextResponse.redirect(new URL("/welcome", request.url));
    response.cookies.set(HOME_COOKIE, userId, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24, path: "/" });
  }
  return response;
}

export const config = {
  // Skip static files, images and the home-screen manifest (phones fetch it signed-out)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|seed/|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
