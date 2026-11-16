import type { Metadata } from "next";
import { IBM_Plex_Mono, Mona_Sans } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

// The Network Intelligence type: Mona Sans for everything, Plex Mono for code.
const sans = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "LinkedIn Studio",
  description: "Write, rate, rank and track your LinkedIn posts. Notion is the database.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
