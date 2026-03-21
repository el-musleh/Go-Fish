import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";

import { AppShell } from "../components/app-shell";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Go Fish",
  description: "Minimal, premium AI event coordination for groups.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${manrope.variable} ${instrumentSerif.variable}`} lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

