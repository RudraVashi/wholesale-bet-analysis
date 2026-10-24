import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Shell } from "@/components/layout/shell";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Formcast — wholesale bet desk",
  description:
    "Personal soccer + NBA slate desk with L10/L20 form, off-pitch notes, and Power play building.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased`}
        style={
          {
            "--font-body": "var(--font-plex-sans), ui-sans-serif, system-ui",
            "--font-display": "var(--font-plex-mono), ui-monospace, monospace",
          } as React.CSSProperties
        }
      >
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}