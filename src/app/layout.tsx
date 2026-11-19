import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { APP_NAME, THEME_COOKIE, themeFrom } from "@/lib/brand";
import { RegisterServiceWorker } from "@/components/ui/register-sw";
import "./globals.css";

// Type is the device's own: SF Pro on Apple devices, the system face on Samsung and other
// Android phones, Segoe on Windows. No web fonts to download, and it feels native everywhere.

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
    <html lang="en-GB" data-theme={theme} suppressHydrationWarning>
      <body>{children}<RegisterServiceWorker /></body>
    </html>
  );
}
