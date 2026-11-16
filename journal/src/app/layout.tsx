import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { loadAll } from "@/lib/journal";
import { SESSION_COOKIE, authEnabled, safeEqual, sessionToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Work Journal",
  description: "Capture thoughts, decisions and requests through the day. Backed by Notion.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Journal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const authed = authEnabled() && !!cookie && safeEqual(cookie, await sessionToken());
  const signedOut = authEnabled() && !authed;

  // Only load journal data once signed in (the login page renders without it).
  const data = signedOut ? null : await loadAll().catch((err) => {
    console.error(err);
    return null;
  });
  const tags = data ? [...new Set(data.entries.flatMap((e) => e.tags))].sort() : [];

  return (
    <html lang="en">
      <body>
        <Shell
          people={data?.people ?? []}
          projects={data?.projects ?? []}
          tags={tags}
          inboxCount={data ? data.entries.filter((e) => !e.reviewed).length : 0}
          mode={data?.mode ?? "notion"}
          authed={authed}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
