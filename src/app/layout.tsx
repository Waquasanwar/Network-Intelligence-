import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Mona_Sans, IBM_Plex_Mono } from "next/font/google";
import { APP_NAME, THEME_COOKIE, themeFrom } from "@/lib/brand";
import { Spotlight } from "@/components/ui/spotlight";
import { RegisterServiceWorker } from "@/components/ui/register-sw";
import "./globals.css";

// Mona Sans, as on the Amana site: one variable family carries everything. Text runs at normal
// width; headlines a touch wider and semibold; small uppercase labels wider still (see globals.css).
const sans = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans-mona", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-fallback", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Expertise known first hand. A private, invitation-led network for roles and consultancy assignments.",
  // A private network: nothing here is meant for search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: "Amana", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#04070f" }, { media: "(prefers-color-scheme: light)", color: "#eef0f5" }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en-GB" data-theme={theme} className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>{children}<Spotlight /><RegisterServiceWorker /></body>
    </html>
  );
}
