import type { Metadata } from "next";
import { Inter_Tight, IBM_Plex_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// The same pair as the Amana site, so the product and the website read as one thing. Inter Tight
// carries everything you read or operate.
const sans = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans-inter", display: "swap" });
// Bricolage Grotesque is the display face: titles and the big numbers, set condensed and bold.
const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-display-bricolage", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-fallback", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Network Intelligence", template: "%s · Network Intelligence" },
  description: "Known. Not just matched. A human-led relationship and expertise intelligence platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
