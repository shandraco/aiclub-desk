import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Bricolage_Grotesque, Gabarito, Geist, Geist_Mono, Instrument_Sans, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { site } from "@/lib/site";
import "./globals.css";

// The club's three faces, self-hosted by next/font. The post canvases use the same variables,
// so the PNG exporter embeds exactly what the preview shows.
const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });
// Display faces for the template families (Shock, Field, Signal). Variable fonts, loaded once.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"], variable: "--font-bricolage", display: "swap" });
const gabarito = Gabarito({ subsets: ["latin"], variable: "--font-gabarito", display: "swap" });
const bigShoulders = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-bigshoulders", display: "swap" });
// The interface's own face, so the chrome never blends into the club's Geist graphics.
const instrument = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-instrument", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111215" },
    { media: "(prefers-color-scheme: dark)", color: "#111215" },
  ],
};

// Runs before first paint so a saved theme never flashes. Allowed by the per-request nonce.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-US" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} ${instrument.variable} ${bricolage.variable} ${gabarito.variable} ${bigShoulders.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
