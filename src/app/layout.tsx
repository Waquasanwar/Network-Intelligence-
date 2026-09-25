import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Aptos is the intended face (it ships with Office, so most viewers on Windows/Mac have it and get
// it for real via the CSS stack). Aptos is proprietary and cannot be web-hosted, so Hanken Grotesk
// — a warm humanist grotesque with near-identical metrics — is the freely-licensed fallback that
// everyone else sees. No Vercel/Geist or other AI-tooling faces.
const sans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans-fallback", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-fallback", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Network Intelligence", template: "%s · Network Intelligence" },
  description: "Known. Not just matched. A human-led relationship and expertise intelligence platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
