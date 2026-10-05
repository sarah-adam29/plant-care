import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import Link from "next/link";
import { Suspense } from "react";
import { store } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plant Care",
  description: "Remembers what's happening with every plant and tells you what to check next.",
  appleWebApp: { capable: true, title: "Plants", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

/**
 * The home name + Settings link in the header. It needs the database, so it
 * sits in its own <Suspense>: the rest of the page (and loading screens) can
 * appear straight away instead of waiting for it.
 */
async function HeaderNav() {
  // Signed out (login page) or not set up yet (welcome page) → no home name to show.
  const viewer = await store.getViewer().catch(() => null);
  if (!viewer) return null;
  return (
    <div className="flex items-center gap-4 text-sm text-muted">
      <span>{viewer.householdName}</span>
      <Link href="/settings" className="font-semibold hover:text-leaf">Settings</Link>
    </div>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions sometimes add attributes to <html>; ignore those harmless mismatches.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <header className="sticky top-0 z-10 bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-[17px] font-bold tracking-tight">
              Plant Care
            </Link>
            <Suspense fallback={null}>
              <HeaderNav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-5 pb-24 pt-2">{children}</main>
      </body>
    </html>
  );
}
