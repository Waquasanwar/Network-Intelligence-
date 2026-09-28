import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Inter carries the whole interface: a modern, neutral grotesque tuned for screens — the same
// register as the products this is measured against. It falls to the Apple system face on Apple
// devices so the typography feels native there too.
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans-inter", display: "swap" });
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
