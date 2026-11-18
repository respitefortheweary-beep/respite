import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const TITLE = "Respite for the Weary · Sober, shared homes in Chester, Virginia";
const DESCRIPTION = "Safe, supportive shared homes in and around Chester, VA for veterans, people in recovery and independent seniors. See open beds and request a room.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: TITLE, template: "%s · Respite for the Weary" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Respite for the Weary",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/images/hero/house-day.webp", alt: "A white clapboard house with a deep front porch on a clear morning" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/images/hero/house-day.webp"] },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, email: false, address: false },
  // Paste the codes from Google Search Console and Bing Webmaster Tools into these env vars
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
  robots: process.env.SHOWCASE
    ? { index: false, follow: false }
    : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-porch px-3 py-2 text-sm font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
