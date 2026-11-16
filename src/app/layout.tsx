import type { Metadata } from "next";
import { Mona_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Mona Sans, as on the Amana site: one variable family carries everything. Text runs at normal
// width; headlines a touch wider and semibold; small uppercase labels wider still (see globals.css).
const sans = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans-mona", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-fallback", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Network Intelligence", template: "%s · Network Intelligence" },
  description: "Known. Not just matched. A human-led relationship and expertise intelligence platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
