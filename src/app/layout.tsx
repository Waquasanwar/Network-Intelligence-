import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Network Intelligence", template: "%s · Network Intelligence" },
  description: "Known. Not just matched. A human-led relationship and expertise intelligence platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
